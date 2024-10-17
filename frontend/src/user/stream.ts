const stream = document.getElementById('stream') as HTMLImageElement

console.log( stream )


async function streamLoop() {

    const response = await fetch('http://localhost:3000/player/stream', {
        credentials: 'include'
    })

    const json = await response.json()

    stream.src = `data:${json['mimeType']};base64,${ json['frame'] }`
    
    requestAnimationFrame(streamLoop)
}

requestAnimationFrame(streamLoop)