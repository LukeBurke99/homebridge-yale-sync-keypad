import { Panel } from 'yalesyncalarm/dist/Model';

/**
 * KeypadContext class to store the id, type and state of a panel 
 */
export class KeypadContext {
    constructor(public id: string, public type: string, public state: Panel.State) {}
}

/**
 * LoggerContext class to store the last updated date and value of a panel 
 */
export class LoggerContext {
    constructor(public lastUpdated: Date, public lastValue: string) {}
}