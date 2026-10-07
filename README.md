title: LoyalFamily - PWA to replace Stocard

# Goals
* Fast
* Can be installed as a PWA
* Loyalty cards need to be cached on the device to make them available when offline
* It must be possible to add new cards preferably by a built in barcode/qr code scanner when online
* When a new loyalty card is added on one device it must be synched to other devices when these devices open the PWA.
* 1 server instance means 1 family, if a card is added; it is either private to the current user or shared to all users
* Users can only join the server upon invitation by the administrator
* When starting the server for the very first time the first user can register itself as administrator
* An administrator can invite other people to join
* An administrator can change the type of account of other people to administrator or regular user


## Docs

- `REQUIREMENTS.md` — what we build (decisions closed)
- `DESIGN.md` — how we build it (schema, API, sync, Docker, milestones)
- `UserGuide.md` — build, run, deploy, back up, admin duties
- `DeveloperGuide.md` — dev environment, tests, architecture rules
