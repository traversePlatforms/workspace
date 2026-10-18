# Captain Nolan's Star Station

A Roblox game for Nolan (age 7). Players collect space critters from a launch pad, carry them to their own base, earn Stardust, steal from friends, and catch thieves. Personal project; nothing here is published to Roblox until Matthew does it from his own account.

## First play-test (no extra tools)

1. Install **Roblox Studio** (free) from roblox.com/create and sign in.
2. Double-click **`StarStation.rbxlx`** in this folder. It opens in Studio with the whole game inside.
3. Press **Play** (F5). You get a title screen, then you spawn at your base.
4. To test stealing with friends in Studio: Test tab → Clients and Servers → 2 players → Start.

**Saving between visits** only works in Studio if you turn it on: Home → Game Settings → Security → **Enable Studio Access to API Services**. Without it the game still runs; it just starts fresh each time.

## How the game works

- Critters slide along the **launch pad** in the middle. Walk up and press **E** to grab one if you have enough Stardust.
- Carry it into **your base** (the one marked "YOUR BASE"). It goes on a pedestal and earns Stardust every second.
- Walk into a friend's base and **hold E** on a critter to steal it. If the owner catches you (gets close) before you get home, it goes back.
- **Base door** (Lock Door button, or the console in your base): a red energy door that keeps everyone out, you included, for 60 seconds. Unlock it any time to get in, but then it cannot lock again for 30 seconds. Stealing only works from inside a base whose door is open.
- **Punch** (Q, a click, or the PUNCH button on a tablet): hit someone carrying a critter and it drops on the floor. Anyone can grab it; the owner's grab sends it straight home, and after 20 seconds it goes home by itself.
- **Parker Bots** (3 hover drones) cruise the walkways. Carry a critter outside a base and they chase you: a catch sends you home and the critter back. Punch one to stun it for 3 seconds.
- **Tablet:** the joystick is bottom-left and Jump bottom-right, so PUNCH and Sprint sit next to Jump, the door and expand buttons stack above them, and the Book button moves under the Stardust counter.
- Rarities: Common, Rare, Epic, Legendary, **Cosmic**. Hammy the Star Cat is Cosmic, the rarest.
- **Mutations:** any critter can land **Golden** (8%: costs 1.5x, earns 2x) or **Rainbow** (1.5%: costs 3x, earns 5x).
- **Stardust stars** float around the deck: run through one to grab it (worth 5, or 3 seconds of your income, whichever is more).
- **Meteor Shower:** 3 minutes in, then every 10 minutes, blue stars rain down for 30 seconds, worth double.
- Feel: critters bob on their pedestals, sparkles when you grab one, confetti when it lands home, "+income" over your base, a red THIEF! alarm when you're robbed, and a glowing beam guiding you home while you carry.

- **Collection Book** (button bottom-left): every critter, found ones in colour, the rest as ???, plus which Golden/Rainbow versions you have had.
- **Pets:** in the Book, tap **Make my pet** on any critter in your base and it floats along beside you (everyone sees it).
- **Black Hole Night** (6 minutes in, then every 8): the lights go purple and the **Void Creeper** roams. It chases the nearest player (a bit slower than you), and a boop sends you home and drops what you carry. Hide in a **locker** (E) and it ignores you. Switch it off with `Config.BlackHoleNight = false`.
- 19 critters across Common, Rare, Epic, Legendary, **Mythic** and Cosmic, plus the surprise slot.

## Changing things

Everything to tune is in `src/shared/Config.lua`: critter names, colours, prices, income, how often they spawn, shield timings.

- **Dad's surprise critter:** the `surprise` entry in `Config.lua`. Give it a name and colours, then set `enabled = true`.
- **Nolan-only critters:** put Nolan's Roblox user ID (a number, from his profile page link) in `Config.ExclusiveUserId`. Don't put his username in the game.

## Working on the code with Claude (Rojo)

The game lives as code files in `src/`; **Rojo** syncs them into Studio live.

- Rojo is installed at `C:\Users\Surge Inc\tools\roblox\dl-rojo\rojo.exe`.
- Install the Studio plugin once: run `rojo.exe plugin install` with Studio closed.
- Then run `rojo.exe serve` in this folder, and click **Connect** in Studio's Rojo panel.
- Rebuild the place file after changes: `rojo.exe build default.project.json -o StarStation.rbxlx`.

## Files

| File | What it does |
|---|---|
| `src/shared/Config.lua` | All names, colours, prices and timings |
| `src/shared/CritterModels.lua` | Builds each critter from shapes (Hammy's tabby stripes are here) |
| `src/server/MapBuilder.lua` | Builds the station: deck, launch pad, 6 bases, Commander statue, planets |
| `src/server/Main.server.lua` | The rules: buying, carrying, stealing, catching, door, punching, Parker Bots, income |
| `src/server/PlayerData.lua` | Saves Stardust and critters |
| `src/client/HUD.client.lua` | Title screen, Stardust counter, door button, punch, messages |

## Next ideas

Black Hole Night (lights out, the Void Creeper roams, hide in lockers), meteor eggs, more critters, rebirths, a "sell" button for a full base.
