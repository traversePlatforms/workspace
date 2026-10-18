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
	-- Nolan's cat: a grey tabby with darker stripes
	{ id = "hammy", name = "Hammy the Star Cat", rarity = "Cosmic", price = 25000, income = 400, shape = "cat",
		body = Color3.fromRGB(150, 148, 145), accent = Color3.fromRGB(85, 82, 80), stripes = true, glow = Color3.fromRGB(255, 186, 125) },
	-- Dad's surprise critter goes here: set enabled = true and fill it in when it's designed
	{ id = "surprise", name = "???", rarity = "Cosmic", price = 30000, income = 500, shape = "blob",
		body = Color3.fromRGB(150, 210, 255), accent = Color3.fromRGB(255, 186, 125), enabled = false },
}

-- only this Roblox user can ever get exclusive critters (Nolan's user ID, a number; 0 = nobody yet)
Config.ExclusiveUserId = 0
Config.ExclusiveCritters = {} -- e.g. { "surprise" }

Config.StartStardust = 60
Config.BaseCount = 6
Config.PedestalsPerBase = 8
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
