// Arquivo app.js
// Criado em 29/04/2024 as 07:48 por Acrisio
// Definição da interface para o cliente

const http = require('http');
const fs = require('fs');
const net = require('net');
const WebSocket = require('ws');
const THSnapshot = require('./th-snapshot');
const THSnapshotServer = require('./th-snapshot-server');

const HOST_PORT = 9988;
const snapshot_server = new THSnapshotServer();

// http server
const http_server = http.createServer(function (req, res) {

	// Home
	if (req.url == '/') {

	    const replace_url = `index.html`;

	    console.log(`[HTTP] URL: ${req.url}, replace URL: ${replace_url}`);

	    fs.readFile(replace_url, function(err, data) {
	        if (err) {
	            res.writeHead(404);
	            res.end('not found');
	            return;
	        }

            res.writeHead(200);
            res.end(data);
	    });

	}else if (req.url.includes('patch_S4/')) {

	    const replace_url = `client-offline/files/${req.url.substring(req.url.indexOf('patch_S4/') + 9)}`;

	    console.log(`[HTTP] URL: ${req.url}, replace URL: ${replace_url}`);

	    fs.readFile(replace_url, function(err, data) {
	        if (err) {
	            res.writeHead(404);
	            res.end('not found');
	            return;
	        }

            res.writeHead(200);
            res.end(data);
	    });

	}else if (req.url.includes('Translation/')) {

	    const replace_url = `client-offline/files/${req.url.substring(req.url.indexOf('Translation/'))}`;

	    console.log(`[HTTP] URL: ${req.url}, replace URL: ${replace_url}`);

	    fs.readFile(replace_url, function(err, data) {
	        if (err) {
	            res.writeHead(404);
	            res.end('not found');
	            return;
	        }

            res.writeHead(200);
            res.end(data);
	    });

	}else { // Unknow

		// Log
		console.log(`[HTTP] URL: ${req.url}`);

		res.writeHead(404);
		res.end(`<html>
			<title>
				Not Found
			</title>
			<body>
				<h2>Not Found</h2>
			</body>
		</html>`);
	}
});

http_server.listen(HOST_PORT, function() {
	console.log(`[HTTP] Http Server Listening in: http://127.0.0.1:${this.address().port}`);
});

function createServerWS() {
    var wss = new WebSocket.WebSocketServer({ server: http_server });

    wss.on('connection', function(ws) {

        console.log('[WSS] client connected');

        ws.on('message', function(data) {

            let req = JSON.parse(data);

            if (!req || req.type === undefined || isNaN(req.type)) {
                console.log(`[WS] invalid request: ${data}`);
                return;
            }

            switch (req.type) {
                case 1: // Make Snapshot
                    {
                        if (req.id == '' || req.password == '') {
                            ws.send(JSON.stringify({
                                type: 1,
                                id: req.id,
                                error: 'invalid inputs'
                            }));
                            break;
                        }

                        const snapshot = new THSnapshot(req.id, req.password);

                        if (!snapshot.start((_success, _msg_err) => {

                            if (!_success) {

                                // Log
                                console.log(`Fail in make snapshot, Error: ${_msg_err}`);

                                ws.send(JSON.stringify({
                                    type: 1,
                                    id: req.id,
                                    error: 'fail to make snapshot'
                                }));

                                return;
                            }

                            ws.send(JSON.stringify({
                                type: 1,
                                id: req.id,
                                error: 'success'
                            }));

                            return;
                        })) {

                            // Log
                            console.log(`Fail in start make snapshot`);

                            ws.send(JSON.stringify({
                                type: 1,
                                id: req.id,
                                error: 'fail to make snapshot, system error'
                            }));

                            break;
                        }

                        break;
                    }
                case 2: // Update List Snapshot
                    {
                        fs.readdir('./', (err, files) => {

                            if (err) {

                                ws.send(JSON.stringify({
                                    type: 2,
                                    list: [],
                                    error: 'fail in read snapshots'
                                }));

                                return;
                            }

                            files = files.filter(el => !el.search(`(login_packets|game_packets)-.+.json`));

                            files = files.map((el, k, arr) => {

                                let m = el.match(`.*-(.*).json`);

                                if (!m || m.at(1) === undefined)
                                    return null;
                                
                                let id = m[1];

                                if (arr.filter(el => !el.search(`(login_packets|game_packets)-${id}.json`)).length < 2)
                                    return null;

                                return id;

                            })
                            .filter(el => el !== null)
                            .reduce((acc, v) => {

                                if (acc.length <= 0 || !acc.includes(v))
                                    acc.push(v);

                                return acc;
                            }, []);

                            ws.send(JSON.stringify({
                                type: 2,
                                list: files,
                                error: 'success'
                            }));
                        });
                        break;
                    }
                case 3: // Update Server, Ligar/Desligar
                    {
                        if (req.state == 1) {

                            if (!snapshot_server.start((_success, _msg_err) => {

                                if (!_success) {

                                    // Log
                                    console.log(`Fail to start snapshot server, Error: ${_msg_err}`);

                                    ws.send(JSON.stringify({
                                        type: 3,
                                        error: 'fail to start snapshot server'
                                    }));

                                    return;
                                }

                                ws.send(JSON.stringify({
                                    type: 3,
                                    error: 'success'
                                }));

                                return;
                            })) {

                                ws.send(JSON.stringify({
                                    type: 3,
                                    error: 'fail to start snapshot server, system error'
                                }));

                                break;
                            }

                        }else if (req.state == 0) {

                            if (!snapshot_server.stop((_success, _msg_err) => {

                                if (!_success) {

                                    // Log
                                    console.log(`Fail to stop snapshot server, Error: ${_msg_err}`);

                                    ws.send(JSON.stringify({
                                        type: 3,
                                        error: 'fail to stop snapshot server'
                                    }));

                                    return;
                                }

                                ws.send(JSON.stringify({
                                    type: 3,
                                    error: 'success'
                                }));

                                return;
                            })) {

                                ws.send(JSON.stringify({
                                    type: 3,
                                    error: 'fail to stop snapshot server, system error'
                                }));

                                break;
                            }
                        }
                        break;
                    }
                case 4:
                    {
                        ws.send(JSON.stringify({
                            type: 4,
                            state: (snapshot_server.is_listening() ? 1 : 0),
                            error: 'success'
                        }));
                        break;
                    }
            }
        });

        ws.on('error', function(error) {
            console.log(`[WS] Client error: ${error}`);
        });

        ws.on('close', function(code, reason) {
            console.log(`[WS] Client close, code: ${code}, reason: ${reason}`);
        });
    });

    wss.on('error', function(error) {
        console.log(`[WSS] Error: ${error}`);
    });

    wss.on('close', () => {
        console.log('[WSS] Closed');
    });

    wss.on('listening', () => {
        console.log('[WSS] Listening');
    });

    return wss;
}

const ws = createServerWS();
