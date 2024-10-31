const stream = document.getElementById('stream') as HTMLImageElement

console.log( stream )


async function streamLoop() {

    //Local testing
    //const URL = 'http://localhost:3000/player/stream'

    //Deployment
    const URL = 'http://project-tagger-app.onrender.com/player/stream'

    const response = await fetch(URL, {
        credentials: 'include'
    })

    if( response ) {

        const json = await response.json()

        stream.src = `data:${json['mimeType']};base64,${ json['frame'] }`
    }
    
    requestAnimationFrame(streamLoop)
}

requestAnimationFrame(streamLoop)