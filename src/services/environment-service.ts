import { ConfigurationManager } from './configuration-manager';
import { ExtensionUtils } from './extension-utils';
import { ShellService } from './shell-service';
import { WorkspaceService } from './workspace-service';
import * as vscode from 'vscode';


export class EnvironmentService {

    public static async fetchSetupEnvironment(context: vscode.ExtensionContext, envSetupCommand: string): Promise<string[]> {
        const extName = ExtensionUtils.getExtensionName(context);
        const envDelimiter = `---${extName} setup---`;
        if (envSetupCommand) {
            const result = await ShellService.run(`${envSetupCommand} && echo ${envDelimiter} && printenv`, WorkspaceService.getInstance().getWorkspaceFolder().uri.path, {});

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