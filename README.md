# QuickSilver Minecraft Proxy

## Overview

QuickSilver is a hot-reloadable Minecraft proxy specifically designed for 2b2t.
It features various capabilities like:

- Automatic queue-unstucking
- Multitenancy and authentication
- The ability to attach and detach to sessions
- Hot-reloadable without disconnecting from the server for upgrades and development
- Push notifications for when you are connected to 2b2t

Licensed under the MIT license.

## Usage

### Installation

This project requires Node.JS to work. Install that, then clone this repo
and run `npm install`.

### Configuration

Copy the `config.json.sample` file to `config.json`.

You will need to sign up for a Pushover account for push notifications
or comment out the relevant sections in the code. Create a new app
and set the user and token fields to the values provided in the `push` section.

For `auth`, give each user their name, password, and a list of emails
for the Minecraft accounts they will have access to attach to.
Granting admin will give this user permission to run arbitrary code
on the server!

For `mc`, create an entry for every Minecraft account you want to use.
Their name should be their Minecraft in-game name for proper functionality.

### Running

Simply run `npm start` to start the proxy.

### Usage

Add the proxy's IP (likely `localhost`) on port 25567 to your Minecraft client running 1.12.2.
Proxy commands can be run at any time by typing any message in chat starting with `qs`.
To start, begin by connecting and attaching to an account.

#### Commands

You can use either the account ID provided in list or a substring of the account name wherever `[account]` is denoted.

- `attach` - `qs attach [account]` - Attaches your client to this account (must be connected first).
- `detach` - `qs detach` - Detaches your client so you can attach to another client.
- `list` - `qs list`
- `connect` - `qs connect [account]` - Tells QuickSilver to connect to 2b2t using this account.
- `disconnect` - `qs disconnect [account]` - Disconnects an account from 2b2t.
- `reload` - `qs reload` - Hot-reloads the proxy. Will disconnect any users connected to the proxy while keeping
the proxy's connections to 2b2t active.
- `eval` - `qs eval [js]` - Evaluates JavaScript on the proxy. Useful for development.
