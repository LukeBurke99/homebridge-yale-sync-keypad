import { Panel } from 'yalesyncalarm/dist/Model';

export class KeypadContext {
    constructor(public id: string, public type: string, public state: Panel.State) {
        this.id = id;
        this.type = type;
        this.state = state;
    }
}