/*
Client-side API for the server
*/

async function api(path, body={}) {
    if (DEBUG === undefined) {
        let DEBUG = false;
    }

    let method = 'POST';
    let headers = {
        'Content-Type': 'application/json',
    }
    
    let res;

    await fetch(path, {
        method: method,
        headers: headers,
        body: JSON.stringify(body),
    }).then(response => response.json())
    .then(data => {
        DEBUG && console.log(data);
        res = data;
    })
    return res;
}


