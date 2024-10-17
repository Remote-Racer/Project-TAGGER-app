
const controlCanvas = document.getElementById('control-canvas') as HTMLCanvasElement

controlCanvas.width = window.innerWidth
controlCanvas.height = window.innerHeight

const controlCanvasCTX = controlCanvas.getContext('2d') as CanvasRenderingContext2D
var controlCanvasFrame = controlCanvas.getBoundingClientRect()

type ControllerStrategy = (ev: Event) => void

class Controller {

    origin: number[]
    axes: number[]
    //displacement: number[]

    scaleFactor: number

    strategy: ControllerStrategy | null
    event: Event | null

    constructor() {

        this.origin = [0, 0]
        this.axes = [0, 0, 0, 0]
        //this.displacement = [0, 0, 0, 0]

        this.scaleFactor = 40

        this.strategy = null
        this.event = null
    }

    render() {

        controlCanvasCTX.beginPath()
        controlCanvasCTX.fillStyle = 'green'
        controlCanvasCTX.ellipse(
            this.origin[0],
            this.origin[1],
            40, 40, 0, 0, 2 * Math.PI
        )
        controlCanvasCTX.fill()

        controlCanvasCTX.beginPath()
        controlCanvasCTX.fillStyle = 'red'
        controlCanvasCTX.strokeStyle = 'red'
        controlCanvasCTX.ellipse(
            this.origin[0] + this.scaleFactor * this.axes[0],
            this.origin[1] + this.scaleFactor * this.axes[1], 
            40, 40, 0, 0, 2 * Math.PI
        )
        controlCanvasCTX.stroke()
    }
}

interface ControlStart {

    origin?: number[]
}

interface ControlMove {

    axes?: number[]
}

var rendering = false
var controller = new Controller()


var start = Date.now();

var usingGamepad = false

var usingKeyboard = false
var controlMomentum = [ 0, 0 ]
var keyheldQueue: string[] = []

const controlLoop = () => {
    
    const current = Date.now()

    const elapsed = current - start

    if( elapsed < 10 ) {

        requestAnimationFrame(controlLoop)
        return
    }

    if( usingGamepad && navigator.getGamepads().length > 0 ) {

        const gamepad = navigator.getGamepads()[0] as Gamepad

        for( let i = 0; i < gamepad.axes.length; i++ ) {

            controller.axes[i] = gamepad.axes[i]
        }
    }
    
    if( usingKeyboard && keyheldQueue.length > 0) {

        for( let code of keyheldQueue) {

            switch( code  ) {
    
                case 'KeyW':
                    controlMomentum[1] -= 0.05
                    break
                case 'KeyS':
                    controlMomentum[1] += 0.05
                    break
                case 'KeyA':
                    controlMomentum[0] -= 0.05
                    break
                case 'KeyD':
                    controlMomentum[0] += 0.05
                    break
            }
        }

        controlMomentum[0] = Math.sign( controlMomentum[0] ) * Math.min( Math.abs( controlMomentum[0] ), 1 )
        controlMomentum[1] = Math.sign( controlMomentum[1] ) * Math.min( Math.abs( controlMomentum[1] ), 1 )

        controller.axes[0] = controlMomentum[0]
        controller.axes[1] = controlMomentum[1]
    }

    if( controller.strategy && controller.event ) {

        controller.strategy( controller.event )
    }

    requestAnimationFrame(controlLoop)
    start = current
}

var rendering = false

const renderLoop = () => {

    controlCanvas.width = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0)
    controlCanvas.height = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)

    controlCanvasFrame = controlCanvas.getBoundingClientRect()

    controlCanvasCTX.clearRect(0, 0, controlCanvasFrame.width, controlCanvasFrame.height)

    if( rendering || usingGamepad ) {

        controller.render()
    }

    requestAnimationFrame( renderLoop )
}

requestAnimationFrame( renderLoop )

interface ControllerEvent {
    origin?: number[]
    axes?: number[]
    displacement?: number[]
}

const mouseStrategy: ControllerStrategy = (ev: Event) => {

    const { origin, axes } = (ev as CustomEvent<ControllerEvent>).detail

    if( origin ) {

        controller.origin = origin
    }

    if( axes ) {

        controller.axes = axes
    }
}

controlCanvas.addEventListener('control-render', (ev: Event) => {

    if( rendering ) return

    rendering = true

    requestAnimationFrame( controlLoop )
})

controlCanvas.addEventListener('control-start', (ev: Event) => {

    const data = (ev as CustomEvent<ControlStart>).detail.origin

    if( data == null ) return

    controller.event = ev

    controller.origin = data
})

controlCanvas.addEventListener('control-move', (ev: Event) => {

    const data = (ev as CustomEvent<ControlMove>).detail.axes

    if( data == null ) return

    controller.event = ev
})

controlCanvas.addEventListener('control-end', (ev: Event) => {

    rendering = false
})

const renderEvent = new CustomEvent<unknown>('control-render')

const gamepadConnection = new CustomEvent<unknown>('gamepadconnected')
const gamepadDisconnection = new CustomEvent<unknown>('gamepaddisconnected')

/**
 * KEYBOARD CONTROL SUPPORT
 */

window.addEventListener('keydown', (ev: KeyboardEvent) => {

    if( !ev.code ) return 

    switch( ev.code ) {

        case 'KeyW':
        case 'KeyS':
        case 'KeyA':
        case 'KeyD':
            usingKeyboard = true
            keyheldQueue.push( ev.code )
            controlCanvas.dispatchEvent( renderEvent )
    }
})

window.addEventListener('keyup', (ev: KeyboardEvent) => {

    if( !ev.code ) return 

    switch( ev.code ) {

        case 'KeyW':
        case 'KeyS':
        case 'KeyA':
        case 'KeyD':
            keyheldQueue = keyheldQueue.filter((value: string) => { return value != ev.code })
            controlCanvas.dispatchEvent( renderEvent )
    }
})

/**
 * MOUSE CONTROL SUPPORT
 */

controlCanvas.addEventListener("mousedown", (ev: MouseEvent) => {

    const startEvent = new CustomEvent<ControlStart>('control-start', {
        detail: {
            origin: [
                ev.clientX - controlCanvasFrame.x,
                ev.clientY - controlCanvasFrame.y
            ]
        }
    })

    controller.strategy = mouseStrategy

    controlCanvas.dispatchEvent( renderEvent )
    controlCanvas.dispatchEvent( startEvent )
})

controlCanvas.addEventListener("mousemove", (ev: MouseEvent) => {

    if( !rendering ) return

    let dX = ev.clientX - controlCanvasFrame.x - controller.origin[0]
    let dY = ev.clientY - controlCanvasFrame.y - controller.origin[1]

    let scaledMagnitude = Math.sqrt( Math.pow(dX / controller.scaleFactor, 2) + Math.pow(dY / controller.scaleFactor, 2) )

    if( scaledMagnitude == 0 ) {

        dX = 0
        dY = 0
    }

    if( scaledMagnitude < 1 ) {

        controller.axes = [ dX / controller.scaleFactor, dY / controller.scaleFactor ]
    } else {

        let magnitude = Math.sqrt( Math.pow(dX, 2) + Math.pow(dY, 2) )

        controller.axes = [ dX / magnitude, dY / magnitude]
    }
})

controlCanvas.addEventListener("mouseup", (ev: MouseEvent) => {

    controlCanvasCTX.clearRect(0, 0, controlCanvasFrame.width, controlCanvasFrame.height)

    rendering = false
})

/**
 * GAMEPAD CONTROL SUPPORT
 */

window.addEventListener('gamepadconnected', (ev: GamepadEvent) => {

    const offsetX = controlCanvasFrame.width / 8
    const offsetY = controlCanvasFrame.height / 4

    const startEvent = new CustomEvent<ControlStart>('control-start', {
        detail: {
            origin: [
                offsetX,
                controlCanvasFrame.height - offsetY
            ]
        }
    })

    usingGamepad = true

    controlCanvas.dispatchEvent( renderEvent )
    controlCanvas.dispatchEvent( startEvent )
})

window.addEventListener('gamepaddisconnected', (ev: GamepadEvent) => {

    usingGamepad = false
})

controlCanvas.addEventListener('touchstart', (ev: TouchEvent) => {

    if( !ev.touches ) return 

    let mouseEvent = new MouseEvent('mousedown', {
        clientX: ev.touches[0].clientX,
        clientY: ev.touches[0].clientY
    })

    controlCanvas.dispatchEvent( mouseEvent )
})

/**
 * TOUCH CONTROL SUPPORT
 */

var touchControlled = false
var lastTouchList: TouchList;

controlCanvas.addEventListener('touchstart', (ev: TouchEvent) => {

    if( !ev.touches ) return 

    let mouseEvent = new MouseEvent('mousedown', {
        clientX: ev.touches[0].clientX,
        clientY: ev.touches[0].clientY
    })

    touchControlled = true
    controlCanvas.dispatchEvent( mouseEvent )
})

controlCanvas.addEventListener('touchmove', (ev: TouchEvent) => {

    if( !ev.touches && !touchControlled ) return 

    ev.preventDefault()

    let mouseEvent: MouseEvent;

    if( !ev.touches ) {

        mouseEvent = new MouseEvent('mousemove', {
            clientX: lastTouchList[0].clientX,
            clientY: lastTouchList[0].clientY
        })
    } else {

        mouseEvent = new MouseEvent('mousemove', {
            clientX: ev.touches[0].clientX,
            clientY: ev.touches[0].clientY
        })

        lastTouchList = ev.touches
    }

    controlCanvas.dispatchEvent( mouseEvent )
})

controlCanvas.addEventListener('touchcancel', (ev: TouchEvent) => {
  
    if( !ev.touches ) return 

    let mouseEvent = new MouseEvent('mouseup')

    touchControlled = false
    controlCanvas.dispatchEvent( mouseEvent )
})


controlCanvas.addEventListener('touchend', (ev: TouchEvent) => {

    ev.preventDefault()

    if( !ev.touches) return

    let mouseEvent = new MouseEvent('mouseup')

    touchControlled = false
    controlCanvas.dispatchEvent( mouseEvent )
})

/**
 * LOGGING
 */

const loggingLoop = () => {

    //console.log( controller.axes )

    requestAnimationFrame( loggingLoop )
}

requestAnimationFrame( loggingLoop )