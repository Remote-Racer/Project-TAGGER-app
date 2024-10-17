const stream = document.getElementById('stream') as HTMLImageElement

console.log( stream )


async function streamLoop() {

    const response = await fetch('https://project-tagger-app.onrender.com/player/stream', {
        credentials: 'include'
    })

    if( response ) {

        const json = await response.json()

        stream.src = `data:${json['mimeType']};base64,${ json['frame'] }`
    }
    
    requestAnimationFrame(streamLoop)
}

requestAnimationFrame(streamLoop)