
/**
 * LoggerData class to store the last updated date and value of a panel 
 */
export class PanelLoggerData {
    public lastUpdated: Date;
    public lastValue: string;

    constructor(d: Date, v: string) {
        this.lastUpdated = d;
        this.lastValue = v;
    }
}