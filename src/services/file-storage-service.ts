////////////////////////////////////////////////////////////////////////////////////
// MIT License
//
// Copyright (c) 2021-2024 NVIDIA Corporation
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
////////////////////////////////////////////////////////////////////////////////////

import { Console } from './console';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import * as vscode from 'vscode';
import oboe = require('oboe');

export class FileStorageService {
    private storagePath: string | undefined;

    constructor(private readonly context: vscode.ExtensionContext) {
        if (this.context.storageUri) {
            this.storagePath = this.context.storageUri.fsPath;

            // Ensure that the directory exists, if not, create it
            if (!fs.existsSync(this.storagePath)) {
                fs.mkdirSync(this.storagePath, { recursive: true });
            }
        } else {
            vscode.window.showErrorMessage('No workspace or folder is opened. Cannot store data.');
        }
    }

    /**
     * Asynchronously writes the given data to a JSON file.
     * @param fileName The name of the file to store the data.
     * @param data The data to store (will be serialized to JSON).
     */
    public async writeJsonToFile<T>(fileName: string, data: T): Promise<void> {
        if (!this.storagePath) {
            vscode.window.showErrorMessage('Cannot save data: No workspace opened.');
            return;
        }

        const filePath = path.join(this.storagePath, fileName);
        await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    }

    public async readJsonArrayElementsFromFileAsStream<T>(
        fileName: string,
        onElement: (path: (string | number)[], value: T) => void,
        cancellationToken?: vscode.CancellationToken
    ): Promise<void> {
        if (!this.storagePath) {
            vscode.window.showErrorMessage('Cannot save data: No workspace opened.');
            return;
        }
        const filePath = path.join(this.storagePath, fileName);
        Console.info(`Reading ${filePath}...`);

        return new Promise<void>((resolve, reject) => {
            cancellationToken?.onCancellationRequested(() => {
                reject(new Error('Reading json file as stream cancelled'));
            });
            if (!fs.existsSync(filePath)) {
                Console.info('No available targets previously cached');
                return resolve();
            }

            oboe(fs.createReadStream(filePath))
                .node('!*.*', (value, path) => {
                    if (cancellationToken?.isCancellationRequested) {
                        reject(new Error('Reading json file as stream cancelled'));
                    }
                    // Match all array elements in the JSON
                    if (typeof path[path.length - 1] === 'number') {
                        // If the last part of the path is a number, it's an array index
                        onElement(path, value);
                    }
                })
                .done(() => {
                    Console.log('Finished processing the JSON file.');
                    resolve();
                })
                .fail((err) => {
                    Console.error('Error processing the JSON file:', err);
                    reject(err);
                });
        });
    }

    /**
     * Asynchronously reads the data from a JSON file.
     * @param fileName The name of the file to read the data from.
     * @returns The parsed data from the file.
     */
    public async readJsonFromFile<T>(fileName: string): Promise<T | null> {
        if (!this.storagePath) {
            vscode.window.showErrorMessage('Cannot read data: No workspace opened.');
            return null;
        }

        const filePath = path.join(this.storagePath, fileName);
        if (!fs.existsSync(filePath)) {
            return null;
        }

        return new Promise<T | null>((resolve, reject) => {
            const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
            const rl = readline.createInterface({
                input: fileStream,
                crlfDelay: Infinity,
            });

            let jsonString = '';
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            rl.on('line', (line: any) => {
                jsonString += line;
            });

            rl.on('close', () => {
                try {
                    const data = JSON.parse(jsonString) as T;
                    resolve(data);
                } catch (err) {
                    vscode.window.showErrorMessage(`Error parsing JSON: ${err}`);
                    reject(err);
                }
            });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            rl.on('error', (err: { message: any; }) => {
                vscode.window.showErrorMessage(`Error reading JSON file: ${err.message}`);
                reject(err);
            });
        });
    }

    /**
     * Asynchronously deletes a JSON file if it exists.
     * @param fileName The name of the file to delete.
     */
    public async deleteFile(fileName: string): Promise<void> {
        if (!this.storagePath) {
            vscode.window.showErrorMessage('Cannot delete file: No workspace opened.');
            return;
        }

        const filePath = path.join(this.storagePath, fileName);
        if (fs.existsSync(filePath)) {
            await fs.promises.unlink(filePath);
        }
    }

    /**
     * Checks if a file exists.
     * @param fileName The name of the file to check for.
     * @returns True if the file exists, false otherwise.
     */
    public fileExists(fileName: string): boolean {
        if (!this.storagePath) {
            vscode.window.showErrorMessage('Cannot check file: No workspace opened.');
            return false;
        }

        const filePath = path.join(this.storagePath, fileName);
        return fs.existsSync(filePath);
    }
}
