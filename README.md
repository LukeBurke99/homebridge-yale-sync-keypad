<p align="center">

<img src="https://github.com/homebridge/branding/raw/latest/logos/homebridge-wordmark-logo-vertical.png" width="150">

</p>

<span align="center">

# Homebridge Plugin - Yale Sync Keypad

</span>

This plugin is for the [Yale Smart Home Alarm](https://yalehome.co.uk/sync-smart-home-alarm) which can be configured here: [Build Your Own Sync Alarm Kit](https://yalehome.co.uk/build-your-own-sync-alarm-starter-kit)


## Features

- This plugin will enable you to bring your Yale Sync Alarm System into your Homebridge setup. It will expose the *Yale Sync Keypad* and allow you to change Between `Home`, `Away`, `Night` and `Off`. 
- This plugin will tie directly into the Yale API and will retrieve data and a constant interval. Changes to the Homebridge accessory will trigger a call to the Yale API and will update your device instantly.

### Please Note

- The Yale Sync Alarm only supports `Disarmed`, `Fully Armed` and `Part Armed`. Because of this, the `Home` and `Night` mode will set the alarm to `Part Armed`.
- The Yale *Motion Sensors* are only active when Alarm is Armed and cannot be used for automations. Also, because of the way that the Yale API works, it could never be instantly responsive (more on that below).

At this moment in time, the Yale API does not provide a webhook integration, meaning all device syncing is done via a polling service. This means that there may be a slight delay depending on your config settings. This plugin will work by constantly retrieving the state of your device from the Yale server at regular intervals (this is called polling). 

A webhook integration would allow the Yale Server to send a message to your Homebridge instance whenever something changes on their server, meaning an instant update to the Homebridge accessory. If this service becomes available and Yale update their API to allow for this, I will be updating this plugin to use that functionality.

## Configuration

- `Name` - The name you would this plugin to use and the name of the Homebridge accessory.
- `Yale Account Username` - The username for your Yale Alarm account. It is recommended to create a new account for this plugin so that your details can't be stolen. You can create a new user and invite them to your home from the Yale Alarm App.
- `Yale Account Password` - The password for your Yale Alarm account. This should be the password for the newly created user that was mentioned above.
- `Background Refresh` - If checked, this will enable the *polling service* and will start fetching the status of your Alarm at constant intervals. Disabling this option will mean that the status of your Yale Alarm will only ever be updated on Homebridge whenever the accessory is selected.
- `Refresh Interval` - The interval in seconds that the plugin will check the alarm state. The minimum value is 5 seconds so that the API is not overloaded. The higher the number, the less requests to the Yale API will be made, however, this means that your Homebridge accessory will be out of sync for longer.

# Bugs

This plugin is in active development and will still have a few bugs. Please let me know of any in the Issues tab on this plugin's GitHub page.