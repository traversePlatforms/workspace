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
	return { stardust = Config.StartStardust, slots = {}, caught = 0 }
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
	if typeof(d.slots) == "table" then
		for k, id in pairs(d.slots) do
			local n = tonumber(k)
			if n and n >= 1 and n <= Config.PedestalsPerBase and Config.fromKey(id) then   -- "cometcat" or "cometcat:golden"
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
