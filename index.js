const { program } = require('commander')
const { Input } = require('midi')
const path = require('node:path')
const { Worker, MessageChannel } = require('node:worker_threads')

let configPath = path.join(
  require('os').homedir(),
  '/.midi-connect/config.json'
)

program.option('-c, --config <path>', 'set config path')

const getConfig = () => {
  const options = program.opts()
  if (options.config) {
    configPath = options.config
  }

  let config = {}
  try {
    config = require(configPath)
  } catch (error) {
    console.error('Failed to load config file. Is the path valid?')
    console.error(error)
    process.exit(1)
  }

  if (!config.midi_in) {
    console.error('No midi_in defined in config')
    process.exit(2)
  }

  if (
    (!config.notes || !Array.isArray(config.notes)) &&
    (!config.controllers || !Array.isArray(config.controllers))
  ) {
    console.error('No notes or controllers defined in config')
    process.exit(3)
  }
  config.notes = config.notes ?? []
  config.controllers = config.controllers ?? []

  return config
}

program
  .command('list')
  .description('list available midi devices')
  .action(() => {
    const input = new Input()
    const ports = input.getPortCount()
    for (let i = 0; i < ports; i++) {
      console.log(`${i}: ${input.getPortName(i)}`)
    }
    input.closePort()
    process.exit(0)
  })

program
  .command('watch')
  .description('watch midi messages')
  .action(() => {
    const config = getConfig()

    const input = new Input()

    input.on('message', (deltaTime, message) => {
      console.log(`m: ${message} d: ${deltaTime}`)
    })

    input.openPort(config.midi_in)
  })

program.command('start', { isDefault: true }).action(() => {
  const config = getConfig()

  const input = new Input()
  input.openPort(config.midi_in)

  const worker = new Worker('./worker.js', {
    workerData: {
      config,
    },
  })

  input.addListener('message', (deltaTime, message) => {
    const activeNotes = []
    const releasedNotes = []

    const [status, note, velocity] = message

    const noteOn = noteConfig => {
      activeNotes.push({
        note,
        velocity,
        ...noteConfig,
      })
    }
    const noteOff = noteConfig => {
      releasedNotes.push({
        note,
        velocity,
        ...noteConfig,
      })
    }

    const noteConfigs = config.notes.filter(
      noteConfig =>
        noteConfig.note == note &&
        (!noteConfig.channel ||
          noteConfig.channel == 0 ||
          noteConfig.channel == message[0])
    )

    if (noteConfigs.length > 0) {
      // Note On
      if (status === 144) {
        noteConfigs.forEach(noteConfig => {
          if (
            (noteConfig.min_vel ?? 0) <= velocity &&
            (noteConfig.max_vel ?? 127) >= velocity
          ) {
            noteOn(noteConfig)
          } else {
            noteOff(noteConfig)
          }
        })
      }

      // Note Off
      if (status === 128) noteConfigs.forEach(noteOff)
    }

    if (
      config.controllers &&
      status === 176 &&
      config.controllers.includes(ccConfig => ccConfig.code == note)
    ) {
      console.log(`Controller: ${note}, Value: ${velocity}`)
    }

    if (activeNotes.length || releasedNotes.length) {
      worker.postMessage({
        activeNotes: activeNotes,
        releasedNotes: releasedNotes,
      })
    }
  })
})

program.parse(process.argv)
