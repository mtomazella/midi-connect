const { parentPort } = require('node:worker_threads')
const { keyToggle } = require('robotjs')

const keysDown = {}
let activeNotes = []
let releasedNotes = []

parentPort.on('message', message => {
  if (message.activeNotes) activeNotes = message.activeNotes
  if (message.releasedNotes) {
    const toRelease = {}
    releasedNotes.forEach(({ keycode }) => {
      if (!keycode || activeNotes.find(element => element.keycode == keycode))
        return
      toRelease[keycode] = true
    })
    releasedNotes.push(...Object.keys(toRelease))
  }

  // console.log({
  //   activeNotes,
  //   releasedNotes,
  // })

  activeNotes.forEach(({ keycode }) => {
    if (!keycode || keysDown[keycode]) return
    keyToggle(keycode, 'down')
    keysDown[keycode] = true
  })
  releasedNotes.forEach(keycode => {
    if (!keycode) return
    keyToggle(keycode, 'up')
    delete keysDown[keycode]
  })
  releasedNotes = []
})
