import { Console } from './console';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import * as vscode from 'vscode';


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
        Console.log('writing file', filePath);
        await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
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
            rl.on('line', (line) => {
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

            rl.on('error', (err) => {
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
     * Checks if a file exists asynchronously.
     * @param fileName The name of the file to check for.
     * @returns True if the file exists, false otherwise.
     */
    public async fileExists(fileName: string): Promise<boolean> {
        if (!this.storagePath) {
            vscode.window.showErrorMessage('Cannot check file: No workspace opened.');
            return false;
        }

        const filePath = path.join(this.storagePath, fileName);
        return fs.existsSync(filePath);
    }
}