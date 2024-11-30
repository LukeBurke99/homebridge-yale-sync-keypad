import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';

import type { YaleSyncKeypadPlatform } from './platform.js';
import { KeypadContext } from './helpers/contexts.js';
import { wait } from './helpers/functions.js';
import { Panel } from 'yalesyncalarm/dist/Model.js';


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
		
		const state = await this.getPanelStateFromYaleApi('current'); // make the api request to get the current state based on the Yale servers
		const accessoryContext = this.accessory.context as KeypadContext;
		this.platform.log.info('Got current state:', accessoryContext.state);

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
		const accessoryContext = this.accessory.context as KeypadContext;
		this.platform.log.info('Got target state: ', accessoryContext.state);

		// Update the target state after fetching the value from the API
		this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemTargetState)
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
			this.platform.lastApiCall = d;
	
			await wait(10000); // similates the time it takes to make an API call and set the this.accessory.context.state value
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
		
		// Update the alarm system state 
		const accessoryContext = this.accessory.context as KeypadContext;
		this.platform.log.info('Panel Changed from: ', `${accessoryContext.state} to ${state}`);
		accessoryContext.state = state;

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


export class ExamplePlatformAccessory {
	private service: Service;

	private exampleStates = {
		On: false,
		Brightness: 100,
	};

	constructor(
		private readonly platform: YaleSyncKeypadPlatform,
		private readonly accessory: PlatformAccessory,
	) {
		// set accessory information
		this.accessory.getService(this.platform.Service.AccessoryInformation)!
			.setCharacteristic(this.platform.Characteristic.Manufacturer, 'Default-Manufacturer')
			.setCharacteristic(this.platform.Characteristic.Model, 'Default-Model')
			.setCharacteristic(this.platform.Characteristic.SerialNumber, 'Default-Serial');

		// get the LightBulb service if it exists, otherwise create a new LightBulb service
		// you can create multiple services for each accessory
		this.service = this.accessory.getService(this.platform.Service.Lightbulb) || this.accessory.addService(this.platform.Service.Lightbulb);

		// set the service name, this is what is displayed as the default name on the Home app
		// in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
		this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.exampleDisplayName);

		// each service must implement at-minimum the "required characteristics" for the given service type
		// see https://developers.homebridge.io/#/service/Lightbulb

		// register handlers for the On/Off Characteristic
		this.service.getCharacteristic(this.platform.Characteristic.On)
			.onSet(this.setOn.bind(this)) // SET - bind to the `setOn` method below
			.onGet(this.getOn.bind(this)); // GET - bind to the `getOn` method below

		// register handlers for the Brightness Characteristic
		this.service.getCharacteristic(this.platform.Characteristic.Brightness)
			.onSet(this.setBrightness.bind(this)); // SET - bind to the `setBrightness` method below


	}

	/**
	 * Handle "SET" requests from HomeKit
	 * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
	 */
	async setOn(value: CharacteristicValue) {
		// implement your own code to turn your device on/off
		this.exampleStates.On = value as boolean;

		this.platform.log.debug('Set Characteristic On ->', value);
	}

	/**
	 * Handle the "GET" requests from HomeKit
	 * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
	 *
	 * GET requests should return as fast as possible. A long delay here will result in
	 * HomeKit being unresponsive and a bad user experience in general.
	 *
	 * If your device takes time to respond you should update the status of your device
	 * asynchronously instead using the `updateCharacteristic` method instead.
	 * In this case, you may decide not to implement `onGet` handlers, which may speed up
	 * the responsiveness of your device in the Home app.
  
	 * @example
	 * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
	 */
	async getOn(): Promise<CharacteristicValue> {
		// implement your own code to check if the device is on
		const isOn = this.exampleStates.On;

		this.platform.log.debug('Get Characteristic On ->', isOn);

		// if you need to return an error to show the device as "Not Responding" in the Home app:
		// throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);

		return isOn;
	}

	/**
	 * Handle "SET" requests from HomeKit
	 * These are sent when the user changes the state of an accessory, for example, changing the Brightness
	 */
	async setBrightness(value: CharacteristicValue) {
		// implement your own code to set the brightness
		this.exampleStates.Brightness = value as number;

		this.platform.log.debug('Set Characteristic Brightness -> ', value);
	}
}
