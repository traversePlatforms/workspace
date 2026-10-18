-- Captain Nolan's Star Station: every number and name in one place, so the game is easy to tune.
local Config = {}

Config.GameTitle = "Captain Nolan's Star Station"
Config.CommanderName = "Captain Nolan"

-- Nolan's colours: light orange and light blue, on a dark space-station deck
Config.Colors = {
	Orange = Color3.fromRGB(255, 186, 125),
	Blue = Color3.fromRGB(150, 210, 255),
	Deck = Color3.fromRGB(38, 44, 64),
	DeckLine = Color3.fromRGB(62, 72, 102),
	Trim = Color3.fromRGB(232, 238, 248),
	Dark = Color3.fromRGB(16, 18, 28),
}

-- weight = how often a critter of that rarity lands on the pad (out of the total)
Config.Rarities = {
	Common = { order = 1, color = Color3.fromRGB(200, 210, 220), weight = 60 },
	Rare = { order = 2, color = Color3.fromRGB(110, 190, 255), weight = 26 },
	Epic = { order = 3, color = Color3.fromRGB(190, 120, 255), weight = 10 },
	Legendary = { order = 4, color = Color3.fromRGB(255, 200, 70), weight = 3.5 },
	Mythic = { order = 5, color = Color3.fromRGB(255, 105, 85), weight = 1.2 }, -- added 2026-10-18
	Cosmic = { order = 6, color = Color3.fromRGB(255, 120, 200), weight = 0.4 },
}

-- shape: blob | bunny | cat | pup | alien | bear | dragon
-- price in Stardust; income = Stardust per second while it sits in your base
Config.Critters = {
	{ id = "blipblob", name = "Blip Blob", rarity = "Common", price = 20, income = 1, shape = "blob",
		body = Color3.fromRGB(140, 230, 170), accent = Color3.fromRGB(90, 180, 120) },
	{ id = "moonbunny", name = "Moon Bunny", rarity = "Common", price = 30, income = 1, shape = "bunny",
		body = Color3.fromRGB(235, 235, 245), accent = Color3.fromRGB(255, 186, 200) },
	{ id = "glorp", name = "Glorp", rarity = "Common", price = 40, income = 2, shape = "alien",
		body = Color3.fromRGB(150, 210, 255), accent = Color3.fromRGB(255, 186, 125) },
	{ id = "cometcat", name = "Comet Cat", rarity = "Rare", price = 150, income = 5, shape = "cat",
		body = Color3.fromRGB(255, 186, 125), accent = Color3.fromRGB(255, 240, 220) },
	{ id = "rocketpup", name = "Rocket Pup", rarity = "Rare", price = 220, income = 7, shape = "pup",
		body = Color3.fromRGB(196, 150, 110), accent = Color3.fromRGB(150, 210, 255) },
	{ id = "starbear", name = "Star Bear", rarity = "Epic", price = 900, income = 20, shape = "bear",
		body = Color3.fromRGB(120, 110, 200), accent = Color3.fromRGB(255, 230, 120) },
	{ id = "nebulafox", name = "Nebula Fox", rarity = "Epic", price = 1300, income = 28, shape = "cat",
		body = Color3.fromRGB(200, 120, 230), accent = Color3.fromRGB(150, 210, 255) },
	{ id = "stardragon", name = "Star Dragon", rarity = "Legendary", price = 5000, income = 90, shape = "dragon",
		body = Color3.fromRGB(90, 160, 255), accent = Color3.fromRGB(255, 186, 125) },
	{ id = "sunbeamsnoot", name = "Sunbeam Snoot", rarity = "Legendary", price = 6500, income = 110, shape = "pup",
		body = Color3.fromRGB(255, 210, 90), accent = Color3.fromRGB(255, 140, 60) },
	-- wave 2 (2026-10-18): nine more, and the Mythic tier
	{ id = "puffball", name = "Puffball", rarity = "Common", price = 25, income = 1, shape = "blob",
		body = Color3.fromRGB(255, 175, 210), accent = Color3.fromRGB(255, 120, 170) },
	{ id = "craterbunny", name = "Crater Bunny", rarity = "Common", price = 35, income = 2, shape = "bunny",
		body = Color3.fromRGB(172, 172, 184), accent = Color3.fromRGB(120, 120, 136) },
	{ id = "zapblob", name = "Zap Blob", rarity = "Rare", price = 180, income = 6, shape = "alien",
		body = Color3.fromRGB(255, 235, 110), accent = Color3.fromRGB(255, 170, 60) },
	{ id = "rocketbunny", name = "Rocket Bunny", rarity = "Rare", price = 260, income = 8, shape = "bunny",
		body = Color3.fromRGB(255, 186, 125), accent = Color3.fromRGB(150, 210, 255) },
	{ id = "galaxypup", name = "Galaxy Pup", rarity = "Epic", price = 1100, income = 24, shape = "pup",
		body = Color3.fromRGB(110, 85, 200), accent = Color3.fromRGB(255, 186, 125) },
	{ id = "saturnbear", name = "Saturn Bear", rarity = "Epic", price = 1600, income = 32, shape = "bear",
		body = Color3.fromRGB(255, 186, 125), accent = Color3.fromRGB(150, 210, 255) },
	{ id = "supernovacat", name = "Supernova Cat", rarity = "Legendary", price = 7500, income = 130, shape = "cat",
		body = Color3.fromRGB(255, 110, 80), accent = Color3.fromRGB(255, 220, 120) },
	{ id = "moonkingbear", name = "Moon King Bear", rarity = "Mythic", price = 12000, income = 200, shape = "bear",
		body = Color3.fromRGB(235, 235, 245), accent = Color3.fromRGB(255, 205, 70), glow = Color3.fromRGB(255, 220, 120) },
	{ id = "blackholedragon", name = "Black Hole Dragon", rarity = "Mythic", price = 15000, income = 240, shape = "dragon",
		body = Color3.fromRGB(55, 35, 85), accent = Color3.fromRGB(190, 120, 255), glow = Color3.fromRGB(190, 120, 255) },
	-- wave 3 (2026-10-18): five new body types
	{ id = "bloopjelly", name = "Bloop Jelly", rarity = "Common", price = 30, income = 1, shape = "jelly",
		body = Color3.fromRGB(170, 225, 255), accent = Color3.fromRGB(110, 190, 255) },
	{ id = "tinbot", name = "Tin Bot", rarity = "Common", price = 45, income = 2, shape = "robot",
		body = Color3.fromRGB(175, 182, 196), accent = Color3.fromRGB(110, 118, 136), glow = Color3.fromRGB(150, 210, 255) },
	{ id = "novachick", name = "Nova Chick", rarity = "Common", price = 50, income = 2, shape = "bird",
		body = Color3.fromRGB(255, 225, 110), accent = Color3.fromRGB(255, 186, 125) },
	{ id = "cometturtle", name = "Comet Turtle", rarity = "Rare", price = 200, income = 6, shape = "turtle",
		body = Color3.fromRGB(110, 180, 120), accent = Color3.fromRGB(255, 186, 125) },
	{ id = "astroowl", name = "Astro Owl", rarity = "Rare", price = 280, income = 8, shape = "bird",
		body = Color3.fromRGB(150, 120, 210), accent = Color3.fromRGB(110, 85, 170) },
	{ id = "octopop", name = "Octo-Pop", rarity = "Rare", price = 320, income = 9, shape = "octo",
		body = Color3.fromRGB(255, 150, 190), accent = Color3.fromRGB(255, 110, 160) },
	{ id = "mechapup", name = "Mecha Pup", rarity = "Epic", price = 1200, income = 26, shape = "robot",
		body = Color3.fromRGB(255, 186, 125), accent = Color3.fromRGB(150, 210, 255), glow = Color3.fromRGB(255, 120, 60) },
	{ id = "nebulajelly", name = "Nebula Jelly", rarity = "Epic", price = 1500, income = 30, shape = "jelly",
		body = Color3.fromRGB(190, 130, 255), accent = Color3.fromRGB(130, 80, 220), glow = Color3.fromRGB(255, 160, 255) },
	{ id = "orbitturtle", name = "Orbit Turtle", rarity = "Epic", price = 1800, income = 34, shape = "turtle",
		body = Color3.fromRGB(110, 170, 255), accent = Color3.fromRGB(230, 240, 255), glow = Color3.fromRGB(150, 220, 200) },
	{ id = "galaxyocto", name = "Galaxy Octopus", rarity = "Legendary", price = 8000, income = 140, shape = "octo",
		body = Color3.fromRGB(40, 50, 110), accent = Color3.fromRGB(90, 110, 220), glow = Color3.fromRGB(150, 210, 255) },
	{ id = "phoenixowl", name = "Phoenix Owl", rarity = "Legendary", price = 9000, income = 155, shape = "bird",
		body = Color3.fromRGB(255, 110, 60), accent = Color3.fromRGB(255, 200, 80), glow = Color3.fromRGB(255, 160, 60) },
	{ id = "quasarbot", name = "Quasar Robot", rarity = "Mythic", price = 14000, income = 220, shape = "robot",
		body = Color3.fromRGB(255, 205, 70), accent = Color3.fromRGB(60, 50, 90), glow = Color3.fromRGB(190, 120, 255) },
	-- Nolan's cat: a grey tabby with darker stripes
	-- Nolan's friends (2026-10-18, from photos): his cats Hammy and Zuzu, Matt the alien plush, and the sunflower plush.
	-- family = true: a special announcement when one lands, and a spot by the Commander statue.
	{ id = "hammy", name = "Hammy", rarity = "Cosmic", price = 25000, income = 400, shape = "cat", family = true,
		body = Color3.fromRGB(128, 128, 136), accent = Color3.fromRGB(84, 84, 92), stripes = true, tailStripes = true,
		eyeColor = Color3.fromRGB(205, 212, 130), muzzle = Color3.fromRGB(240, 238, 232), tailColor = Color3.fromRGB(118, 118, 126),
		glow = Color3.fromRGB(255, 186, 125), material = "Fabric" },
	{ id = "zuzu", name = "Zuzu", rarity = "Cosmic", price = 28000, income = 450, shape = "cat", family = true,
		body = Color3.fromRGB(250, 246, 240), accent = Color3.fromRGB(236, 196, 160), earColor = Color3.fromRGB(232, 176, 138),
		cap = Color3.fromRGB(240, 196, 150), capStripe = Color3.fromRGB(214, 140, 80), chest = Color3.fromRGB(255, 255, 252),
		tailColor = Color3.fromRGB(240, 220, 200), eyeColor = Color3.fromRGB(90, 130, 190), glow = Color3.fromRGB(150, 210, 255), material = "Fabric" },
	{ id = "matt", name = "Matt", rarity = "Mythic", price = 13000, income = 210, shape = "matt", family = true,
		body = Color3.fromRGB(78, 190, 58), accent = Color3.fromRGB(236, 234, 214), glow = Color3.fromRGB(190, 255, 120), material = "Fabric" },
	{ id = "sunnysprout", name = "Sunny Sprout", rarity = "Legendary", price = 7000, income = 120, shape = "sunflower", family = true,
		body = Color3.fromRGB(150, 222, 92), accent = Color3.fromRGB(255, 196, 88), face = Color3.fromRGB(215, 145, 115), rim = Color3.fromRGB(128, 68, 48),
		glow = Color3.fromRGB(255, 210, 100), material = "Fabric" },
	-- Dad's surprise critter goes here: set enabled = true and fill it in when it's designed
	{ id = "surprise", name = "???", rarity = "Cosmic", price = 30000, income = 500, shape = "blob",
		body = Color3.fromRGB(150, 210, 255), accent = Color3.fromRGB(255, 186, 125), enabled = false },
}

-- only this Roblox user can ever get exclusive critters (Nolan's user ID, a number; 0 = nobody yet)
Config.ExclusiveUserId = 0
Config.ExclusiveCritters = {} -- e.g. { "surprise" }

Config.StartStardust = 60
Config.BaseCount = 8 -- 4 on each side (2026-10-18: bigger map). Set the place's Max Players to 8 in Game Settings.
Config.PedestalsPerBase = 8 -- pedestals every base starts with
Config.MaxPedestals = 12 -- after buying both expansions
Config.ExpandCosts = { 2500, 10000 } -- each adds 2 pedestals
Config.SellBack = 0.4 -- selling a critter gives back 40% of its price

-- sprint: hold Shift (or the Sprint button on a phone); the energy bar drains while running and refills when you stop
Config.Sprint = { walk = 16, run = 27, drainPerSecond = 25, refillPerSecond = 14, refillDelay = 0.8 }
Config.SpawnEvery = 2.5 -- seconds between critters landing on the pad
Config.ConveyorSpeed = 7 -- studs per second
Config.ShieldSeconds = 45
Config.ShieldCooldown = 90
Config.StealHold = 1.5 -- seconds to hold E to steal
Config.CatchDistance = 7 -- owner this close to a thief takes their critter back
Config.AutosaveEvery = 60

-- Mutations (2026-10-18): any critter can land Golden or Rainbow; they cost a bit more and earn a lot more
Config.Mutations = {
	{ id = "rainbow", name = "Rainbow", chance = 0.015, income = 5, price = 3 },
	{ id = "golden", name = "Golden", chance = 0.08, income = 2, price = 1.5, color = Color3.fromRGB(255, 205, 70) },
}

-- Stardust stars floating around the station to run and grab
Config.Stars = {
	count = 24, -- how many are out at once
	value = 5, -- the least a star is worth
	incomeFactor = 3, -- or 3 seconds of your base's income, whichever is more
	respawnMin = 3, respawnMax = 7,
	pickupDistance = 5,
}
Config.MeteorFirst = 180 -- seconds until the first Meteor Shower
Config.MeteorEvery = 600 -- then every 10 minutes
Config.MeteorSeconds = 30
Config.MeteorPerSecond = 3
Config.MeteorStarBonus = 2 -- shower stars are worth double

-- Black Hole Night: the lights go out and the Void Creeper roams; hide in a locker. Set to false to switch it off.
Config.BlackHoleNight = true
Config.NightFirst = 360 -- seconds until the first one
Config.NightEvery = 480 -- then every 8 minutes
Config.NightSeconds = 60
Config.CreeperSpeed = 13 -- a little slower than a player (16), so you can always get away
Config.CreeperReach = 5

function Config.critterById(id)
	for _, c in ipairs(Config.Critters) do
		if c.id == id then
			return c
		end
	end
	return nil
end

function Config.mutationById(id)
	for _, m in ipairs(Config.Mutations) do
		if m.id == id then
			return m
		end
	end
	return nil
end

-- a saved critter is "cometcat" or "cometcat:golden"
function Config.keyOf(defId, mutId)
	return mutId and (defId .. ":" .. mutId) or defId
end

function Config.fromKey(key)
	if typeof(key) ~= "string" then
		return nil, nil
	end
	local id, mutId = key:match("^([%w_]+):?([%w_]*)$")
	local def = id and Config.critterById(id)
	if not def then
		return nil, nil
	end
	local mut = (mutId and mutId ~= "") and Config.mutationById(mutId) or nil
	if mutId and mutId ~= "" and not mut then
		return nil, nil
	end
	return def, mut
end

-- the name, price and income of a critter with its mutation
function Config.statsOf(def, mut)
	local name = mut and (mut.name .. " " .. def.name) or def.name
	local price = math.floor(def.price * (mut and mut.price or 1))
	local income = math.floor(def.income * (mut and mut.income or 1))
	return name, price, income
end

return Config
