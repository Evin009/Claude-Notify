'use strict';

const { writeConfig } = require('./config');
const { listTracks } = require('./library');
const { play } = require('./player');
const { patchHook, hookInstalled } = require('./hooks');

async function runWizard() {
  const { default: inquirer } = await import('inquirer');

  console.log('\n Claude-Notify Setup\n');

  const { enabled } = await inquirer.prompt([{
    type: 'confirm',
    name: 'enabled',
    message: 'Enable notifications when Claude finishes?',
    default: true,
  }]);

  const { musicEnabled } = await inquirer.prompt([{
    type: 'confirm',
    name: 'musicEnabled',
    message: 'Play music when Claude finishes?',
    default: true,
  }]);

  let music = null;
  let musicDuration = 15;
  let volume = 80;

  if (musicEnabled) {
    const tracks = listTracks();
    const trackChoices = [
      ...tracks.map(t => ({ name: `${t.name} — ${t.vibe}`, value: t.id })),
      { name: 'Custom file (enter path)', value: '__custom__' },
    ];

    const { trackChoice } = await inquirer.prompt([{
      type: 'list',
      name: 'trackChoice',
      message: 'Choose a track:',
      choices: trackChoices,
    }]);

    if (trackChoice === '__custom__') {
      const { customPath } = await inquirer.prompt([{
        type: 'input',
        name: 'customPath',
        message: 'Absolute path to your MP3/AAC file:',
        validate: (v) => v.trim().length > 0 || 'Enter a file path',
      }]);
      music = customPath.trim();
    } else {
      music = trackChoice;
      console.log('  Playing 3s preview...');
      await play(music, 3, 80);
    }

    const { dur } = await inquirer.prompt([{
      type: 'input',
      name: 'dur',
      message: 'How many seconds should music play? (0 = play until track ends)',
      default: '15',
      validate: (v) => (!isNaN(parseInt(v, 10)) && parseInt(v, 10) >= 0) || 'Enter a number >= 0',
      filter: (v) => parseInt(v, 10),
    }]);
    musicDuration = dur;

    const { vol } = await inquirer.prompt([{
      type: 'input',
      name: 'vol',
      message: 'Volume (0-100):',
      default: '80',
      validate: (v) => {
        const n = parseInt(v, 10);
        return (!isNaN(n) && n >= 0 && n <= 100) || 'Enter a number 0-100';
      },
      filter: (v) => parseInt(v, 10),
    }]);
    volume = vol;
  }

  const config = { enabled, music, musicDuration, volume };
  writeConfig(config);
  console.log('\n Config saved to ~/.claude-notify.json');

  if (!hookInstalled()) {
    const { patch } = await inquirer.prompt([{
      type: 'confirm',
      name: 'patch',
      message: 'Add Stop hook to ~/.claude/settings.json automatically?',
      default: true,
    }]);

    if (patch) {
      patchHook();
      console.log(' Hook added to ~/.claude/settings.json');
    } else {
      console.log('\nAdd this manually to ~/.claude/settings.json:');
      console.log(JSON.stringify({
        hooks: { Stop: [{ command: 'claude-notify fire --duration=$CLAUDE_SESSION_DURATION' }] }
      }, null, 2));
    }
  } else {
    console.log(' Hook already installed');
  }

  console.log('\nSetup complete. Run: claude-notify config\n');
}

module.exports = { runWizard };
