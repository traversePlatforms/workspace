# Captain Nolan's Star Station

A Roblox game for Nolan (age 7). Players collect space critters from a launch pad, carry them to their own base, earn Stardust, steal from friends, and catch thieves. Personal project; nothing here is published to Roblox until Matthew does it from his own account.

## First play-test (no extra tools)

1. Install **Roblox Studio** (free) from roblox.com/create and sign in.
2. Double-click **`StarStation.rbxlx`** in this folder. It opens in Studio with the whole game inside.
3. Press **Play** (F5). The title screen asks which game: **Star Station** (you spawn at your base) or **Splash Lagoon**, the water park.
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
- **Gear Bay** (beside the launch tunnel, on the side away from the spawn): buy once with Stardust, keep for good. **Boing Glove** (250): a boxing glove on a spring, long reach, big knock-back. **Star Blaster** (2,000): shoots a star bolt at whoever is in front of you; walls and locked doors stop it. **Jet Boots** (900): always on, jump higher and press jump again in the air for a rocket boost. Weapons sit in the backpack bar; hold one and Q, a click or the PUNCH button (now BOING or ZAP) uses it.
- **Animations:** the glove's spring shoots out and the blaster kicks and flashes.
- **Sound:** music (with a Music button top right), a spooky drone for Black Hole Night, and effects for buying, stars, the alarm, punches, weapons, doors, selling and the bots. Every id is in `Config.Sounds`: swap any you don't like.
- **Moon Rover** (parked near the spawn): press E or tap **Drive**, steer with WASD or the joystick, Jump to get out. Faster than sprinting, can't run anyone over, rides over walkways but not into bases. No critters in the rover. Left alone away from its spot, it goes home after 30 seconds.
- **Rocket launches:** press **Launch!** at the red console by either rocket: a 5-second countdown, then it lifts off through a gap in the roof with fire, smoke and engine noise. A new rocket stands on the pad 25 seconds later.
- **Captain Nolan** (his Roblox user ID is `Config.ExclusiveUserId`): a captain's hat and name tag, a CAPTAIN ON DECK fanfare when he joins, and the **Captain's Controls** in front of his statue: Meteor Shower, Black Hole Night, Change Lights, Rain Stardust, Launch Rockets. Only he sees them. In Studio everyone is the Captain so it can be tested (`Config.CaptainInStudio`).
- **Arm swings:** punches play Roblox's own slash animation and the Boing Glove its lunge, so everyone sees them.
- **Metal gate:** locking your door rolls a metal shutter down over the doorway; unlocking rolls it up. Locks last 30 seconds, then 15 seconds before you can lock again.
- **Space Furniture** (across the tunnel from the Gear Bay): Bean Bag and Rocket Bed (sit on them), Disco Ball (party lights), Moon Trampoline (bounce), Telescope (a camera tour of the planets), Arcade Machine (a Stardust prize every 90 seconds, 1 in 10 a jackpot). Bought once; it appears in whichever base you get.
- **Upgrade Lab** (by the spawn): Turbo Legs (3 levels of speed), Double Jump, Stun Power (3 levels: your hits stun people and Parker Bots longer). Every punch now slows the person hit for a moment, with stars round their head.
- **Low Gravity:** every 7 minutes (first at 4), gravity drops for 40 seconds. Nolan has a button for it too. An invisible lid keeps everyone inside the station.
- **Open roof:** no roof beams, more planets overhead, twinkling stars, and a comet every couple of minutes. The lights hover as drones.
- **Stars:** your own screen grabs a Stardust star the moment you touch it, so pickups feel instant even with lag.
- **Void Creeper** can't go into bases, and anyone inside a base is safe from it.
- **Looks:** brighter lighting and floors, two proper rockets (main one with boosters and a launch tower), a moon rover, a UFO beaming up crates, and Earth, Mars and a striped giant outside the windows.
- Rarities: Common, Rare, Epic, Legendary, **Cosmic**. Hammy the Star Cat is Cosmic, the rarest.
- **Mutations:** any critter can land **Golden** (8%: costs 1.5x, earns 2x) or **Rainbow** (1.5%: costs 3x, earns 5x).
- **Stardust stars** float around the deck: run through one to grab it (worth 5, or 3 seconds of your income, whichever is more).
- **Meteor Shower:** 3 minutes in, then every 10 minutes, blue stars rain down for 30 seconds, worth double. The screen gives a short, small rumble when it starts and a bump when a meteor lands near you (sizes and an off switch in `Config.ScreenShake`).
- **Earnings on the tag:** critters on the launch pad belt show a third line in green, "+30 Stardust/s": what they earn every second once they're in your base. It stays on while you carry one over your head.
- Feel: critters bob on their pedestals, sparkles when you grab one, confetti when it lands home, "+income" over your base, a red THIEF! alarm when you're robbed, and a glowing beam guiding you home while you carry.

- **Collection Book** (button bottom-left): every critter, found ones in colour, the rest as ???, plus which Golden/Rainbow versions you have had.
- **Pets:** in the Book, tap **Make my pet** on any critter in your base and it floats along beside you (everyone sees it).
- **Black Hole Night** (6 minutes in, then every 8): the lights go purple and the **Void Creeper** roams. It chases the nearest player (a bit slower than you), and a boop sends you home and drops what you carry. Hide in a **locker** (E) and it ignores you. Switch it off with `Config.BlackHoleNight = false`.
- 19 critters across Common, Rare, Epic, Legendary, **Mythic** and Cosmic, plus the surprise slot.

## Splash park: Splash Lagoon (added 2026-11-07)

A second game inside the same place: a sunny water park. It is built 4,000 studs east of the station, so the two never see or touch each other, and it is all original (no other game's name, map or characters).

**Picking a game.** The title screen now shows two big cards: **Star Station** and **Splash Lagoon**. Tap one to play it. The **Switch game** button (top right, under Music) brings the cards back at any time; **Keep playing** closes them. Picking moves you to that game's arrival spot. If you reset or fall, you come back in the game you were playing. Star Station plays exactly as before for anyone who picks it.

**Your base while you're away.** Your base, critters and income all stay on the station and keep earning. Nobody can steal from you while you're at Splash Lagoon (you can't guard it from there). Going to the park while carrying a critter puts it back (a stolen one goes home to its owner, a bought one is refunded).

**What's in the park and how it's played:**

- **Real swimming:** the pools are Roblox terrain water, so everyone swims the normal Roblox way. The water edge is level with the path, so you just walk in and climb out.
- **Wave pool** (north-west, with a sandy beach): a wave rolls in every 9 seconds from the deep end to the beach. Swim near it and it carries you toward the beach with a bob up. Floats bob on top.
- **Lazy river** (south-west): a square loop round a palm-tree island. The current carries you round, even if you stop swimming. Rubber rings drift round with you.
- **Water slides** (north of the main path, all ending in the big splash pool). Stand on a slide's glowing pad and press **Ride!** (E, or tap the button). You go up, sit down, and slide down; you always land in the pool with a SPLASH.
  - **Corkscrew**: two turns round a tower (about 7 seconds).
  - **Big Drop**: the tall one, straight down, fastest.
  - **Rainbow Racer**: two lanes side by side, with a 3-2-1-GO countdown and your time at the bottom. Two friends press Ride together and race.
- **Cannonball Tower** (north side of the splash pool): press **Climb up** on its pad to go to the high board, walk off or jump. A big jump into the water makes a CANNONBALL! splash (MEGA from higher up). The **Springboard** at the pool's west edge flings you out over the water.
- **Splash pad** (south-east): fountains, coloured spots, and the **big bucket** on its tower, which tips every 45 seconds (the sign counts down). Stand under it to get SOAKED!
- **Water blaster:** the **SPLASH** button (where PUNCH is on a tablet; Q or a click on a computer) sprays water in front of you. Hit a friend and they get a splash and a "SOAKED!" on their screen. That's all it does: no damage, no knock-back, nobody sent anywhere. There's no punching and no weapons in the park.
- **Splash Tokens** (gold coins on the paths and floating on the pools): run or swim through one for **4 Stardust**, the same Stardust as on the station. Kept small on purpose so the park can't outpace a base full of critters.
- **Rubber ducks:** 12 hidden around the park (one floats in the river, two are on pool floors, one is up the Cannonball Tower). Press **Pick up**. Each is worth 100 Stardust once, all 12 another 500. The count is on screen ("Ducks: 3 / 12") and saved with the rest of your save, so ducks you've found stay found.
- **Captain Nolan** keeps his hat and name tag in the park, and gets two buttons there (top right, only he sees them; in Studio everyone does): **Giant Wave** (a huge wave in the wave pool) and **Bubble Party** (20 bubbles over the splash pad and path, each paying like a token, gone after 25 seconds).
- **Bright daytime look:** lighting is shared by the whole server, so each park player's own screen paints a sunny day with a little haze and puts the station's look back when they switch.

**Station events stay on the station.** Players at Splash Lagoon are never chased by the Void Creeper or Parker Bots, never sent home, never punched, never floated by Low Gravity (each park player's screen holds normal gravity for its own character), never turned purple by Black Hole Night or tinted by the Captain's lights, and never shaken by a Meteor Shower. The station's event messages, shouts and the night music don't play for them either.

**Sounds:** the park reuses ids already in `Config.Sounds` (the whoosh, the star ding, the upgrade sound) plus Roblox's own built-in splash file (`rbxasset://sounds/impact_water.mp3`, the one characters make jumping in water). Three are placeholders with `id = 0`, so they're silent until you put a Creator Store id in: `parkMusic` (until then the station's music plays in the park), `bucket` and `wave`.

**Tuning:** prices, timings and amounts are in `Config.Park`. Where everything sits (pools, slide paths, ducks, token spots) is in `src/shared/ParkLayout.lua`. `Config.Park.enabled = false` closes the park (its card then says "Opening soon").

**If something in the park breaks,** it can't stop the station: every part of the park is built and started inside its own safety wrapper. Look in Studio's Output window for lines starting `[Splash Lagoon]`; they say which part failed. If the ground and water themselves fail, the park stays closed and the title card says "Opening soon".

### What to test in Studio first

None of this has been run in Roblox yet, so these are the things most likely to need a small tweak:

1. **Press Play, watch Output** for any red errors or `[Splash Lagoon]` warnings. Then pick Splash Lagoon on the title screen: you should land by the arch in bright daylight.
2. **Each slide** (Corkscrew, Big Drop, both Racer lanes): does the character sit and follow the slide smoothly, and land in the pool? If a rider sits too high or low on the slide, change `UP` near the top of the slides section in `ParkPlay.client.lua` (2.4 now).
3. **Swimming:** walk into each pool. Check you can climb out at the edges, the lazy river carries you round (speed is `L.River.speed`), and the wave pool's waves push you gently toward the beach.
4. **Cannonball Tower and Springboard:** climb, jump, and look for the CANNONBALL! splash.
5. **The bucket:** stand under it until it tips (45 seconds), and check you get SOAKED!.
6. **Two players** (Test tab → Clients and Servers → 2): soak each other with SPLASH, race on the Rainbow Racer, check tokens pay Stardust.
7. **Switch game** back to the station: lights, gravity and music should be the station's again, and your critters still there. Press the Captain's Black Hole Night or Low Gravity button on the station with a second player in the park: the park player should see and feel nothing.
8. **Ducks:** pick one up, stop and start the test with saving on, and check it stays found.
9. **On the iPad:** the park adds terrain water and roughly 700 parts, no lights and small particle effects, so it should be fine, but check FPS there with the Stats overlay as described above.

## Changing things

Everything to tune is in `src/shared/Config.lua`: critter names, colours, prices, income, how often they spawn, shield timings.

- **Dad's surprise critter:** the `surprise` entry in `Config.lua`. Give it a name and colours, then set `enabled = true`.
- **Nolan-only critters:** put Nolan's Roblox user ID (a number, from his profile page link) in `Config.ExclusiveUserId`. Don't put his username in the game.

## Will it lag on the iPad? How to check

Studio on a PC is far faster than a tablet, so "smooth in Studio" proves little. What to look at:

1. **Device Emulator** (Test tab → Device → pick an iPad). Shows the iPad's screen shape and touch buttons, so it's good for checking that labels are readable. It does **not** slow the game down to iPad speed.
2. **Lower Studio's graphics** to roughly tablet level: File → Studio Settings → Rendering → Editor Quality Level → Level 3 or so, then play. Closer to what an iPad draws.
3. **Stats overlay** while playing: View tab → Stats section → **Summary** and **Render** (hover a button to see its shortcut; Shift+F5 in Studio *stops* the play-test, so use the buttons). Watch **FPS**: 60 is smooth, under 30 feels laggy. Rendering shows draw calls and triangles: if they jump when you walk somewhere, that spot is the heavy one.
4. **MicroProfiler** (Ctrl+F6, or in the Roblox app on the iPad: Settings → Micro Profiler → On). Each bar is one frame. At 60 FPS a frame has 16.7 ms. Bars that are tall, orange or red are frames that ran over. Press Ctrl+P to pause and hover the widest blocks: "Render" means too much to draw, "Physics" means moving parts, and script names under Heartbeat/RenderStepped mean a script doing too much each frame.
5. **Developer Console** (F9 in Studio; on the iPad open it from the Roblox menu or type `/console` in chat). **Memory** tab: under about 1,000 MB on the client is comfortable for a tablet; well over 1,500 MB risks crashes on older iPads. **Scripts** tab: a script that sits above about 3-5% activity all the time is worth a look. **ScriptProfiler** tab: record 10 seconds of play and it lists which functions took the most time.
6. **The real test** is playing on the iPad itself: the MicroProfiler and Developer Console both work in the Roblox app there.

The thresholds above are rules of thumb, not Roblox limits. Things that usually make a game lag on a tablet: lots of lights (especially many at once in one place), shadows on lots of parts, parts that move every frame, big see-through parts stacked in front of each other, lots of particles, and scripts that do heavy work every frame.

Also worth a look in Studio (the Rojo build doesn't set these, so they're whatever Studio picks): **Lighting → Technology** (Future is the heaviest; ShadowMap or Voxel is lighter on a tablet) and **Workspace → StreamingEnabled** (leave it off for this game: the client scripts expect the whole station to be there, and the station is small enough that streaming wouldn't save much).

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
| `src/server/GearTools.lua` | The Boing Glove, Star Blaster and Jet Boots, built from parts |
| `src/server/Furniture.lua` | The six furniture pieces and where each sits in a base |
| `src/client/Station.client.lua` | Gates, disco balls, trampolines, comets, extra stars |
| `src/client/Rover.client.lua` | Steering the Moon Rover while you drive |
| `src/client/Audio.client.lua` | Music and the Music button |
| `src/client/Gear.client.lua` | Jet Boots boost and flames, Gear Bay prompt labels |
| `src/client/HUD.client.lua` | Title screen with the game picker, Switch game button, Stardust counter, door button, punch, messages |
| `src/shared/ParkLayout.lua` | Splash Lagoon: where the pools, slides, ducks and token spots are, the slide paths, the river's current |
| `src/server/ParkBuilder.lua` | Builds Splash Lagoon: terrain ground and water, slides, towers, splash pad, bucket, palms, ducks |
| `src/server/ParkServer.lua` | Splash Lagoon's rules: tokens, ducks (saved), the water blaster, the bucket timer, the Captain's park buttons |
| `src/client/ParkPlay.client.lua` | Playing the park: riding slides, river current, waves, cannonballs, the SPLASH button, duck count |
| `src/client/ParkWorld.client.lua` | The park's sunny sky and normal gravity on park players' screens, and putting the station's back |

## Next ideas

Black Hole Night (lights out, the Void Creeper roams, hide in lockers), meteor eggs, more critters, rebirths, a "sell" button for a full base.
