-- Saves each player's Stardust and critters between visits (Roblox DataStores).
-- In Studio, saving needs: Game Settings > Security > "Enable Studio Access to API Services". Without it the game still runs; it just doesn't save.
local DataStoreService = game:GetService("DataStoreService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Config = require(ReplicatedStorage.Shared.Config)

local PlayerData = {}
local cache = {}
local store = nil
pcall(function()
	store = DataStoreService:GetDataStore("StarStation_v1")
end)

local function default()
	return { stardust = Config.StartStardust, slots = {}, caught = 0, found = {}, pet = nil, pedestals = Config.PedestalsPerBase, gear = {}, furniture = {}, upgrades = {} } -- found: the Collection Book; pet: the critter that follows you; gear: what you bought in the Gear Bay
end

-- keep only what the game understands, so a bad save can't break anything
local function clean(d)
	if typeof(d) ~= "table" then
		return default()
	end
	local out = default()
	if typeof(d.stardust) == "number" and d.stardust >= 0 then
		out.stardust = math.floor(d.stardust)
	end
	if typeof(d.caught) == "number" then
		out.caught = math.floor(d.caught)
	end
	if typeof(d.found) == "table" then
		for key, v in pairs(d.found) do
			if v == true and Config.fromKey(key) then
				out.found[key] = true
			end
		end
	end
	if typeof(d.pedestals) == "number" then
		out.pedestals = math.clamp(math.floor(d.pedestals), Config.PedestalsPerBase, Config.MaxPedestals)
	end
	if typeof(d.gear) == "table" then
		for id, v in pairs(d.gear) do
			if v == true and Config.gearById(id) then
				out.gear[id] = true
			end
		end
	end
	if typeof(d.furniture) == "table" then
		for id, v in pairs(d.furniture) do
			if v == true and Config.furnitureById(id) then
				out.furniture[id] = true
			end
		end
	end
	if typeof(d.upgrades) == "table" then -- levels, capped at what each upgrade has
		for id, lv in pairs(d.upgrades) do
			local u = Config.upgradeById(id)
			if u and typeof(lv) == "number" then
				out.upgrades[id] = math.clamp(math.floor(lv), 0, #u.prices)
			end
		end
	end
	if typeof(d.pet) == "string" and Config.fromKey(d.pet) then
		out.pet = d.pet
	end
	if typeof(d.slots) == "table" then
		for k, id in pairs(d.slots) do
			local n = tonumber(k)
			if n and n >= 1 and n <= Config.MaxPedestals and Config.fromKey(id) then   -- "cometcat" or "cometcat:golden"
				out.slots[tostring(n)] = id
			end
		end
	end
	return out
end

local function key(player)
	return "p_" .. player.UserId
end

function PlayerData.load(player)
	local raw = nil
	if store then
		for _ = 1, 3 do
			local ok, res = pcall(function()
				return store:GetAsync(key(player))
			end)
			if ok then
				raw = res
				break
			end
			task.wait(1)
		end
	end
	local d = clean(raw)
	cache[player] = d
	return d
end

function PlayerData.get(player)
	return cache[player]
end

function PlayerData.save(player)
	local d = cache[player]
	if not (store and d) then
		return false
	end
	local ok = pcall(function()
		store:SetAsync(key(player), d)
	end)
	return ok
end

function PlayerData.release(player)
	PlayerData.save(player)
	cache[player] = nil
end

function PlayerData.saveAll()
	for player in pairs(cache) do
		PlayerData.save(player)
	end
end

return PlayerData
