import { BazelService } from './bazel-service';
import { EnvVarsUtils } from './env-vars-utils';
import { BazelTarget } from '../models/bazel-target';
import * as vscode from 'vscode';

export class AttachConfigService {
    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly setupEnvVars: string[]
    ) {}

    /**
     * Create an attach debug configuration based on the target language.
     */
    public async createAttachConfig(target: BazelTarget, port: number): Promise<vscode.DebugConfiguration> {
        switch (BazelService.inferLanguageFromRuleType(target.ruleType)) {
        case 'cpp':
            return this.createCppAttachConfig(target, port);
        case 'python':
            return this.createPythonAttachConfig(target, port);
        case 'go':
            return this.createGoAttachConfig(target, port);
        default:
            throw new Error(`Unsupported language for attach: ${target.ruleType}`);
        }
    }

    /**
     * Create a C++ attach configuration.
     */
    private createCppAttachConfig(target: BazelTarget, port: number): vscode.DebugConfiguration {
        return {
            name: `${target.label} (Attach)`,
            type: 'cppdbg',
            request: 'attach',
            miDebuggerServerAddress: `localhost:${port}`, // Port where gdbserver is listening
            program: '${workspaceFolder}/path/to/binary', // Adjust path to point to the binary
            cwd: '${workspaceFolder}',
            environment: EnvVarsUtils.listToArrayOfObjects(this.setupEnvVars),
            externalConsole: false,
            setupCommands: [
                {
                    description: 'Enable pretty-printing for gdb',
                    text: '-enable-pretty-printing',
                    ignoreFailures: true
                }
            ]
        };
    }

    /**
     * Create a Python attach configuration.
     */
    private createPythonAttachConfig(target: BazelTarget, port: number): vscode.DebugConfiguration {
        return {
            name: `${target.label} (Attach)`,
            type: 'python',
            request: 'attach',
            connect: {
                host: 'localhost',
                port: port // Port where debugpy is listening
            },
            cwd: '${workspaceFolder}',
            pathMappings: [
                {
                    localRoot: '${workspaceFolder}',
                    remoteRoot: '/app' // Adjust as needed for your environment
                }
            ],
            justMyCode: false,
            console: 'integratedTerminal'
        };
    }

    /**
     * Create a Go attach configuration.
     */
    private createGoAttachConfig(target: BazelTarget, port: number): vscode.DebugConfiguration {
        return {
            name: `${target.label} (Attach)`,
            type: 'go',
            request: 'attach',
            mode: 'remote',
            host: '127.0.0.1',
            port: port, // Port where dlv is listening
            cwd: '${workspaceFolder}',
            trace: 'verbose', // Enable verbose logging for debugging
            showLog: true,
            disconnectAction: 'terminate',
        };
    }
}
