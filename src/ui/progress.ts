import * as vscode from 'vscode';


export async function showProgress(title: string, longMethod: (token: vscode.CancellationToken) => Promise<any>): Promise<any> {

    return new Promise<string>((resolve, reject) => {

        vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Blue Bazel: ${title}`,
                cancellable: true
            },
            async (progress, cancellationToken) => {
                progress.report({ increment: undefined, message: '...' });

                try {
                    const result = await longMethod(cancellationToken);
                    progress.report({ increment: undefined, message: 'Finished.' });
                    resolve(result);
                } catch (error) {
                    progress.report({ increment: undefined, message: 'Cancelled.' });
                    reject(error);
                }
            }
        );
    });
}