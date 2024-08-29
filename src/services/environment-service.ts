import * as vscode from 'vscode';
import { ConfigurationManager } from './configuration-manager';
import { ExtensionUtils } from './extension-utils';
import { ShellService } from './shell-service';


export class EnvironmentService {

    constructor(private readonly context: vscode.ExtensionContext,
        private readonly configurationManager: ConfigurationManager,
        private readonly shellService: ShellService
    ) { }

    public async fetchSetupEnvironment(): Promise<string[]> {
        const envSetupCommand = this.configurationManager.getSetupEnvironmentCommand();
        const extName = ExtensionUtils.getExtensionName(this.context);
        const envDelimiter = `---${extName} setup---`;
        if (envSetupCommand) {
            const result = await this.shellService.runShellCommand(`${envSetupCommand} && echo ${envDelimiter} && printenv`, false)

            const env = result.stdout.replace(new RegExp(`[\\s\\S]*?${envDelimiter}\n`, 'g'), '').split('\n');
            const envArray: string[] = [];
            let currentVariable = '';
            for (const line of env) {
                if (line.includes('=')) {
                    if (currentVariable) {
                        const [name, value] = currentVariable.split('=');
                        envArray.push(`${name}=${value}`);
                    }
                    currentVariable = line;
                } else if (currentVariable) {
                    currentVariable += `\n${line}`;
                }
            }

            if (currentVariable) {
                const [name, value] = currentVariable.split('=');
                envArray.push(`${name}=${value}`);
            }

            return envArray;
        }
        return [];
    }
}