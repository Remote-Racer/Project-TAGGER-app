
export type ScheduledRequest = {

    name: string
    execute: () => Promise<void>
}

export var requester: ScheduledRequest[] = []

async function scheduleLoop() {

    for( const { name, execute } of requester ) {
        
        await execute()
    }

    requestAnimationFrame( scheduleLoop )
}

requestAnimationFrame( scheduleLoop )