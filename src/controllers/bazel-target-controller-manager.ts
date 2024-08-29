class BazelTargetControllerManager {
    private controllers: Map<string, BazelTargetController> = new Map();

    constructor() {
        this.controllers.set('build', new BuildController());
        this.controllers.set('run', new RunController());
        this.controllers.set('test', new TestController());
        this.controllers.set('debug', new DebugController());
    }

    public getController(action: string): BazelTargetController | undefined {
        return this.controllers.get(action);
    }
}