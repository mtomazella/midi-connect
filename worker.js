const { parentPort } = require('node:worker_threads')
const { keyToggle } = require('robotjs')

const keysDown = {}

parentPort.on('message', message => {
  let activeNotes = []
  let releasedNotes = []

  if (message.activeNotes) activeNotes = message.activeNotes
  if (message.releasedNotes) releasedNotes = message.releasedNotes

  activeNotes.forEach(({ keycode }) => {
    if (!keycode || keysDown[keycode]) return
    console.log('down', keycode)
    keyToggle(keycode, 'down')
    keysDown[keycode] = true
  })
  releasedNotes.forEach(({ keycode }) => {
    if (!keycode) return
    console.log('up', keycode)
    keyToggle(keycode, 'up')
    keysDown[keycode] = false
  })
  releasedNotes = []
})
