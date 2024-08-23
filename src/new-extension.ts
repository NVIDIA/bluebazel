// export function activate(context: vscode.ExtensionContext) {
//     const model = new BazelTargetManager(context);
//     const controller = new BazelTargetController(model);
//     const treeDataProvider = new BazelTreeProvider(controller);

//     vscode.window.registerTreeDataProvider('bazelTasks', treeDataProvider);

//     vscode.commands.registerCommand('bazelTasks.buildTarget', async (target: BazelTarget) => {
//         await vscode.window.withProgress({
//             location: vscode.ProgressLocation.Notification,
//             title: `Building ${target.label}`,
//             cancellable: false
//         }, async () => {
//             await controller.buildTarget(target);
//         });

//         treeDataProvider.refresh();
//     });

//     vscode.commands.registerCommand('bazelTasks.addTarget', () => {
//         vscode.window.showInputBox({ placeHolder: 'Enter Bazel target label' }).then(label => {
//             if (label) {
//                 controller.addTarget(label, 'build'); // Default to build action
//                 treeDataProvider.refresh();
//             }
//         });
//     });
// }