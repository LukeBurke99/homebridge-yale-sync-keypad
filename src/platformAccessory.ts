import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';

import type { YaleSyncKeypadPlatform } from './platform.js';
import { KeypadContext } from './helpers/contexts.js';
import { wait } from './helpers/functions.js';
import { Panel } from 'yalesyncalarm/dist/Model.js';

/**
 * NOTES:
 * 
 * if you need to return an error to show the device as "Not Responding" in the Home app: 
 * 		throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
 */




/**
 * An instance of this class is created for each panel accessory your platform registers.
 * TODO: Add a button to this accessory to trigger the alarm by adding an onclick event to send the trigger request to the Yale Sync API
 */
export class AlarmSystemPlatformAccessory {
	private service: Service;


	constructor(private readonly platform: YaleSyncKeypadPlatform, private readonly accessory: PlatformAccessory) {
		const accessoryContext = accessory.context as KeypadContext;

		// set accessory information
		this.accessory.getService(this.platform.Service.AccessoryInformation)!
			.setCharacteristic(this.platform.Characteristic.Name, accessory.displayName)
			.setCharacteristic(this.platform.Characteristic.Manufacturer, 'Yale')
			.setCharacteristic(this.platform.Characteristic.Model, 'Yale IA-320')
			.setCharacteristic(this.platform.Characteristic.SerialNumber, accessoryContext.id);

		// get the Security System service if it exists, otherwise create a new Security System service
		this.service = this.accessory.getService(this.platform.Service.SecuritySystem) || this.accessory.addService(this.platform.Service.SecuritySystem);

		// add the event handler for getting the current state of the alarm system
		this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemCurrentState)
			.onGet(() => {
				this.getCurrentState();
				return this.stateTranslateYaleToHAP(this.accessory.context.state);
			});
		this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemTargetState)
			.onGet(() => {
				this.getTargetState();
				return this.stateTranslateYaleToHAP(this.accessory.context.state);
			});

		// // add the event handler for setting the state of the alarm system
		this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemTargetState)
			.onSet((value: CharacteristicValue) => {
				this.setTargetState(value);
				return this.stateTranslateYaleToHAP(this.accessory.context.state);
			});
	}


	/**
	 * Get the current state of the alarm system by fetching the state from the Yale Sync API
	 */
	private async getCurrentState(): Promise<void> {
		this.platform.log.info('Getting current state of the alarm system');
		
		await wait(100); // wait so that the target state is updated before fetching the current state
		const state = await this.getPanelStateFromYaleApi('current'); // make the api request to get the current state based on the Yale servers
		this.platform.log.info('Got current state:', this.accessory.context.state);

		// Update the current state after fetching the value from the API
		this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemCurrentState)
			.updateValue(state);
	}

	/**
	 * Get the target state of the alarm system by fetching the state from the Yale Sync API
	 */
	private async getTargetState(): Promise<void> {
		this.platform.log.info('Getting target state of the alarm system');
		
		const state = await this.getPanelStateFromYaleApi('target'); // make the api request to get the current state based on the Yale servers
		this.platform.log.info('Got target state: ', this.accessory.context.state);

		// Update the target state and the current state after fetching the value from the API
		this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemTargetState)
			.updateValue(state);
		this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemCurrentState)
			.updateValue(state);
	}

	/**
	 * Use the same function for getting the current state and the target state of the alarm system
	 * Get the current state of the panel by sending a request to the Yale Sync API.
	 * Return it so that we can update the cached value in the accessory context
	 * @returns The state of the alarm system
	 */
	private async getPanelStateFromYaleApi(area: string): Promise<CharacteristicValue> {
		const d = new Date();

		// Check if the time since the last API call is less than 1 second and If it is, return the cached value
		if (!this.platform.lastApiCall || d.getTime() - this.platform.lastApiCall.getTime() > 1000) {
			if (this.platform.yaleSyncApi) {
				this.platform.lastApiCall = d;
				this.platform.log.info('Fetching Panel State from Yale Sync API');
				const yalePanelState = await this.platform.yaleSyncApi.getPanelState();
				this.accessory.context.state = yalePanelState;
			} else {
				this.platform.log.error('Yale Sync API not initialized. Couldn\'t fetch from Yale Servers');
				throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
			}
		} else {
			this.platform.log.warn('Using cached value for ', area);
		}
		
		return this.stateTranslateYaleToHAP(this.accessory.context.state);
	}


	/**
	 * Change the state of the alarm system by sending a request to the Yale Sync API after converting the HAP state to the Yale Sync state
	 * @param value The target state of the alarm system (HAP state)
	 */
	private async setTargetState(value: CharacteristicValue) : Promise<void> {
		const state = this.stateTranslateHAPToYale(value);
		this.platform.log.info('Setting Panel to: ', `${state} (${value})`);

		await wait(10000); // similates the time it takes to make an API call
		
		// Update the alarm system state in the accessory context
		this.platform.log.info('Panel Changed from: ', `${this.accessory.context.state} to ${state}`);
		this.accessory.context.state = state;

		// Update the target state after making API calls
		this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemCurrentState)
			.updateValue(value);
	}


	//#region Convertors

	/**
	 * Convert the state of the panel (retrieved from Yale Sync API) to the HAP state
	 * @param state The state on the panel retrieved from the Yale Sync API
	 * @returns The HAP state to be displayed in the Home app
	 */
	private stateTranslateYaleToHAP(state: Panel.State): CharacteristicValue {
		switch (state) {
			case Panel.State.Armed:
				return this.platform.Characteristic.SecuritySystemCurrentState.AWAY_ARM;
			case Panel.State.Home:
				return this.platform.Characteristic.SecuritySystemCurrentState.NIGHT_ARM;
			case Panel.State.Disarmed:
				return this.platform.Characteristic.SecuritySystemCurrentState.DISARMED;
		}
	}

	/**
	 * Convert the state of the panel (retrieved from HAP) to the Yale Sync state
	 * @param state The HAP state
	 * @returns The Yale Sync state
	 */
	private stateTranslateHAPToYale(state: CharacteristicValue): Panel.State {
		switch (state) {
			case this.platform.Characteristic.SecuritySystemCurrentState.AWAY_ARM:
				return Panel.State.Armed;
			case this.platform.Characteristic.SecuritySystemCurrentState.STAY_ARM:
			case this.platform.Characteristic.SecuritySystemCurrentState.NIGHT_ARM:
				return Panel.State.Home;
			case this.platform.Characteristic.SecuritySystemCurrentState.DISARMED:
				return Panel.State.Disarmed;
			default:
				this.platform.log.error('Unknown state: ', state);
				return Panel.State.Armed;
		}
	}

	//#endregion
}

