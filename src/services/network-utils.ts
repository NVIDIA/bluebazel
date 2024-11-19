import * as net from 'net';
import * as vscode from 'vscode';

export async function getAvailablePort(): Promise<number> {
    return new Promise<number>((resolve, reject) => {
        const server = net.createServer();

        // Let the OS assign an available port by listening on port 0
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            if (address && typeof address === 'object') {
                const port = address.port;
                server.close((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(port);
                    }
                });
            } else {
                reject(new Error('Failed to get server address'));
            }
        });

        server.on('error', (err) => {
            reject(err);
        });
    });
}

function checkPortAvailable(port: number, host: string): Promise<void> {
    return new Promise((resolve, reject) => {
        // Create a server instead of a client connection
        const server = net.createServer();

        server.once('error', (err: NodeJS.ErrnoException) => {
            server.close();

            if (err.code === 'EADDRINUSE') {
                // Port is in use, which means the debug server is likely running
                resolve();
            } else {
                reject(err);
            }
        });

        server.once('listening', () => {
            // If we can listen, the port is free (debug server isn't running yet)
            server.close();
            reject(new Error('Port is not in use'));
        });

        // Try to bind to the port
        server.listen(port, host);
    });
}


export async function waitForPort(
    port: number,
    cancellationToken: vscode.CancellationToken,
    pollingIntervalMs = 500,
    host = '127.0.0.1',
): Promise<void> {

    while (!cancellationToken.isCancellationRequested) {
        try {
            await checkPortAvailable(port, host);
            return; // Port is listening
        } catch (error) {
            // Port is not available yet, wait for the interval
            await new Promise<void>((resolve) => setTimeout(resolve, pollingIntervalMs));
        }
    }

    // If the cancellation was requested, throw an error or simply return
    throw new Error(`Waiting for port ${port} was cancelled.`);
}
