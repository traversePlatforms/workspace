-- Captain Nolan's Star Station: the game rules. Grab critters off the launch pad, carry them home, earn Stardust,
-- grab Stardust stars, steal from friends, close your airlock, and catch thieves before they get home.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")

local Config = require(ReplicatedStorage.Shared.Config)
local CritterModels = require(ReplicatedStorage.Shared.CritterModels)
local MapBuilder = require(script.Parent.MapBuilder)
local PlayerData = require(script.Parent.PlayerData)

local map = MapBuilder.build()
local stationFolder = map.critterFolder.Parent

local remotes = Instance.new("Folder")
remotes.Name = "Remotes"
remotes.Parent = ReplicatedStorage
local function remote(name)
	local r = Instance.new("RemoteEvent")
	r.Name = name
	r.Parent = remotes
	return r
end
local Notify = remote("Notify")
local ShieldRequest = remote("ShieldRequest")
local FX = remote("FX") -- sparkles, pop-up numbers, the steal alarm (drawn on each player's screen)
local SetPet = remote("SetPet") -- pick which of your critters follows you around
local Expand = remote("Expand") -- buy two more pedestals
local Drop = remote("Drop") -- put down what you are carrying (2026-10-18: to grab something better)

-- a sound from Config.Sounds: at a spot in the world for everyone nearby, or just for one player (2026-10-18)
local function sfx(name, pos, player)
	if player then
		FX:FireClient(player, "sfx", name, pos)
	else
		FX:FireAllClients("sfx", name, pos)
	end
end

local state = {} -- [player] = { base = base, carrying = { model, crit, from = { owner, slot } | nil } }
local conveyor = {}

local function now()
	return workspace:GetServerTimeNow()
end

local function tell(player, text, kind)
	if player and player.Parent then
		Notify:FireClient(player, text, kind or "info")
	end
end

local function tellAll(text, kind)
	Notify:FireAllClients(text, kind or "info")
end

local function addCommas(n)
	local s = tostring(math.floor(n))
	local out = s:reverse():gsub("(%d%d%d)", "%1,"):reverse()
	return (out:gsub("^,", ""))
end

-- a critter as the game counts it: its kind, its mutation, and what that makes it worth
local function makeCrit(def, mut)
	local name, price, income = Config.statsOf(def, mut)
	return { key = Config.keyOf(def.id, mut and mut.id), def = def, mut = mut, name = name, price = price, income = income }
end

local function radiusOf(def)
	return 1.5 * CritterModels.scaleFor(def)
end

-- ---------- stats ----------
local function incomeOf(st)
	local income = 0
	if st and st.base then
		for _, rec in pairs(st.base.slots) do
			income += rec.crit.income
		end
	end
	return income
end

local function refreshStats(player)
	local d = PlayerData.get(player)
	local st = state[player]
	if not (d and st) then
		return
	end
	local ls = player:FindFirstChild("leaderstats")
	if ls then
		ls.Stardust.Value = d.stardust
		local n = 0
		for _ in pairs(d.slots) do
			n += 1
		end
		ls.Critters.Value = n
	end
	player:SetAttribute("Income", incomeOf(st))
	player:SetAttribute("Stardust", d.stardust)
	-- the Collection Book (every critter you have ever had) and what is in your base now, for the screens
	local found, owned, ownedSet = {}, {}, {}
	for key in pairs(d.found) do
		table.insert(found, key)
	end
	if st.base then
		for _, rec in pairs(st.base.slots) do
			if not ownedSet[rec.crit.key] then
				ownedSet[rec.crit.key] = true
				table.insert(owned, rec.crit.key)
			end
		end
	end
	player:SetAttribute("NextExpand", (st.base and Config.ExpandCosts[(st.base.unlocked - Config.PedestalsPerBase) / 2 + 1]) or 0)
	player:SetAttribute("Found", table.concat(found, ","))
	player:SetAttribute("Owned", table.concat(owned, ","))
	local pet = player:GetAttribute("Pet")
	if pet and not ownedSet[pet] then -- your pet was stolen: it stops following you
		player:SetAttribute("Pet", nil)
	end
end

local function markFound(player, crit)
	local d = PlayerData.get(player)
	if d and not d.found[crit.key] then
		d.found[crit.key] = true
		tell(player, "NEW! " .. crit.name .. " is in your Collection Book!", "rare")
	end
end

-- ---------- pedestals ----------
local tryStealing

local function placeOnPedestal(base, slot, crit)
	local ped = base.pedestals[slot]
	local model = CritterModels.build(crit.def, ped.top * CFrame.new(0, radiusOf(crit.def) + 0.3, 0), crit.mut)
	CritterModels.setInfo(model, "+" .. addCommas(crit.income) .. " Stardust/s")
	model:SetAttribute("OnPedestal", true) -- each screen makes it bob
	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = "Steal"
	prompt.ObjectText = crit.name
	prompt.HoldDuration = Config.StealHold
	prompt.MaxActivationDistance = 9
	prompt.RequiresLineOfSight = true -- the walls and windows block it (2026-10-18)
	prompt:SetAttribute("OwnerUserId", base.owner and base.owner.UserId or 0) -- the owner's own screen hides it
	prompt.Enabled = base.shieldUntil <= now()
	prompt.Parent = model.PrimaryPart
	prompt.Triggered:Connect(function(who)
		tryStealing(who, base, slot)
	end)
	-- the owner can sell it (F) to make room; only the owner's screen shows this one
	local sell = Instance.new("ProximityPrompt")
	sell.ActionText = "Sell (+" .. addCommas(math.floor(crit.price * Config.SellBack)) .. ")"
	sell.ObjectText = crit.name
	sell.KeyboardKeyCode = Enum.KeyCode.F
	sell.GamepadKeyCode = Enum.KeyCode.ButtonY
	sell.HoldDuration = 1
	sell.MaxActivationDistance = 9
	sell.RequiresLineOfSight = false
	sell.UIOffset = Vector2.new(0, 70)
	sell:SetAttribute("OnlyFor", base.owner and base.owner.UserId or 0)
	sell.Parent = model.PrimaryPart
	sell.Triggered:Connect(function(who)
		if who ~= base.owner or base.slots[slot] == nil or base.slots[slot].model ~= model then
			return
		end
		local d = PlayerData.get(who)
		if not d then
			return
		end
		local value = math.floor(crit.price * Config.SellBack)
		base.slots[slot] = nil
		d.slots[tostring(slot)] = nil
		d.stardust += value
		FX:FireAllClients("burst", model:GetPivot().Position, Config.Colors.Orange)
		sfx("sell", model:GetPivot().Position)
		model:Destroy()
		refreshStats(who)
		tell(who, "Sold " .. crit.name .. " for " .. addCommas(value) .. " Stardust.", "info")
	end)
	model.Parent = map.critterFolder
	base.slots[slot] = { model = model, crit = crit, prompt = prompt }
	return model
end

local function freeSlot(base)
	for i = 1, base.unlocked do
		if not base.slots[i] then
			return i
		end
	end
	return nil
end

-- ---------- carrying ----------
local function insideBase(base, pos)
	local p = base.cf:PointToObjectSpace(pos)
	return math.abs(p.X) < base.halfW and math.abs(p.Z) < base.halfD
end

local function rootOf(player)
	local ch = player.Character
	return ch and ch:FindFirstChild("HumanoidRootPart")
end

local function attach(player, model, crit, from)
	local hrp = rootOf(player)
	if not hrp then
		return false
	end
	for _, d in ipairs(model:GetDescendants()) do
		if d:IsA("ProximityPrompt") then
			d:Destroy()
		end
	end
	model:SetAttribute("OnPedestal", nil)
	local body = model.PrimaryPart
	model:PivotTo(hrp.CFrame * CFrame.new(0, 3.2 + radiusOf(crit.def), 0))
	body.Anchored = false
	body.Massless = true
	local w = Instance.new("WeldConstraint")
	w.Name = "CarryWeld"
	w.Part0 = hrp
	w.Part1 = body
	w.Parent = body
	CritterModels.setInfo(model, from and "STOLEN! Run home!" or "Take it home!")
	state[player].carrying = { model = model, crit = crit, from = from }
	player:SetAttribute("Carrying", crit.name) -- the guide beam home
	return true
end

local function clearCarry(player)
	local st = state[player]
	if st then
		st.carrying = nil
	end
	if player.Parent then
		player:SetAttribute("Carrying", nil)
	end
end

-- a carried critter that never made it home: a stolen one goes back to its owner, a bought one is refunded
local function dropCarried(player, reason)
	local st = state[player]
	local c = st and st.carrying
	if not c then
		return
	end
	clearCarry(player)
	if c.model then
		c.model:Destroy()
	end
	if c.from then
		local owner = c.from.owner
		local ost = owner and state[owner]
		local od = owner and PlayerData.get(owner)
		if ost and ost.base and od then
			local slot = c.from.slot
			if ost.base.slots[slot] then
				slot = freeSlot(ost.base) -- its old pedestal was filled meanwhile: any free one
			end
			if slot then
				placeOnPedestal(ost.base, slot, c.crit)
				od.slots[tostring(slot)] = c.crit.key
				refreshStats(owner)
				tell(owner, "Your " .. c.crit.name .. " came back home!", "good")
			end
		end
		if reason == "caught" then
			tell(player, "Caught! " .. c.crit.name .. " went back to its owner.", "bad")
		elseif reason == "dropped" then
			tell(player, "You put " .. c.crit.name .. " down. It went back to its owner.", "info")
		end
	else
		local d = PlayerData.get(player)
		if d then
			d.stardust += c.crit.price
			refreshStats(player)
			if player.Parent then
				tell(player, "You dropped " .. c.crit.name .. ". All " .. addCommas(c.crit.price) .. " Stardust back.", "info")
			end
		end
	end
end

local function bringHome(player)
	local st = state[player]
	local c = st.carrying
	local d = PlayerData.get(player)
	local slot = freeSlot(st.base)
	if not (c and d and slot) then
		return
	end
	clearCarry(player)
	c.model:Destroy()
	local model = placeOnPedestal(st.base, slot, c.crit)
	d.slots[tostring(slot)] = c.crit.key
	d.caught += 1
	markFound(player, c.crit)
	refreshStats(player)
	FX:FireAllClients("confetti", model:GetPivot().Position)
	tell(player, c.crit.name .. " joined your base! +" .. addCommas(c.crit.income) .. " Stardust every second", "good")
	if c.from and c.from.owner and c.from.owner ~= player then
		tell(c.from.owner, player.DisplayName .. " got away with your " .. c.crit.name .. "!", "bad")
	end
end

-- ---------- buying from the launch pad ----------
local function tryBuy(player, item)
	local st = state[player]
	local d = PlayerData.get(player)
	if item.taken or not (st and d) then
		return
	end
	local crit = item.crit
	if not st.base then
		tell(player, "The station is full right now: no free base for you yet.", "bad")
		return
	end
	if st.carrying then
		tell(player, "Your hands are full! Take your critter home first.", "bad")
		return
	end
	if d.stardust < crit.price then
		tell(player, "You need " .. addCommas(crit.price - d.stardust) .. " more Stardust for " .. crit.name .. ".", "bad")
		return
	end
	if not freeSlot(st.base) then
		tell(player, "Your base is full! Every pedestal has a critter.", "bad")
		return
	end
	item.taken = true
	d.stardust -= crit.price
	refreshStats(player)
	local at = item.model:GetPivot().Position
	if not attach(player, item.model, crit, nil) then
		d.stardust += crit.price
		refreshStats(player)
		item.model:Destroy()
		return
	end
	FX:FireAllClients("burst", at, Config.Rarities[crit.def.rarity].color)
	sfx("buy", at)
	tell(player, "Got " .. crit.name .. "! Carry it to your base.", "good")
end

-- ---------- stealing ----------
tryStealing = function(thief, base, slot)
	local owner = base.owner
	local st = state[thief]
	if not (owner and st) or owner == thief then
		return
	end
	if base.shieldUntil > now() then
		tell(thief, "Their door is locked! Wait for it to open.", "bad")
		return
	end
	local thrp = rootOf(thief)
	if not (thrp and insideBase(base, thrp.Position)) then -- no stealing through the walls (2026-10-18)
		return
	end
	if st.carrying then
		tell(thief, "Your hands are full!", "bad")
		return
	end
	if not (st.base and freeSlot(st.base)) then
		tell(thief, "Your base is full, so there's nowhere to take it.", "bad")
		return
	end
	local rec = base.slots[slot]
	local od = PlayerData.get(owner)
	if not (rec and od) then
		return
	end
	base.slots[slot] = nil
	od.slots[tostring(slot)] = nil
	refreshStats(owner)
	if not attach(thief, rec.model, rec.crit, { owner = owner, slot = slot }) then
		rec.model:Destroy()
		placeOnPedestal(base, slot, rec.crit)
		od.slots[tostring(slot)] = rec.crit.key
		refreshStats(owner)
		return
	end
	FX:FireClient(owner, "alarm", base.index)
	tell(thief, "You grabbed " .. rec.crit.name .. "! Run to your base before they catch you!", "good")
	tell(owner, "THIEF! " .. thief.DisplayName .. " is stealing your " .. rec.crit.name .. ". Catch them!", "bad")
end

-- ---------- airlock shield ----------
-- the door (2026-10-18): locked = a solid red energy door nobody can pass, owner included; steal prompts off
local function setShieldVisual(base, on)
	base.shield.Transparency = on and 0.25 or 1
	base.shield.CanCollide = on
	for _, lamp in ipairs(base.doorLamps or {}) do
		lamp.Color = on and Color3.fromRGB(255, 70, 80) or Color3.fromRGB(80, 230, 120)
	end
	for _, rec in pairs(base.slots) do
		rec.prompt.Enabled = not on
	end
end

local function unlockDoor(base, why)
	base.shieldUntil = 0
	base.cooldownUntil = now() + Config.ShieldCooldown -- the risk: no locking again for a while
	base.root:SetAttribute("ShieldUntil", 0)
	base.root:SetAttribute("CooldownUntil", base.cooldownUntil)
	setShieldVisual(base, false)
	sfx("unlock", base.cf.Position)
	if base.owner then
		tell(base.owner, why == "timer" and "Your door opened by itself. Guard your critters!" or ("Door unlocked. You can lock it again in " .. Config.ShieldCooldown .. " seconds."), "info")
	end
end

local function toggleDoor(player)
	local st = state[player]
	local base = st and st.base
	if not base then
		return
	end
	local t = now()
	if base.shieldUntil > t then
		unlockDoor(base, "owner")
		return
	end
	if base.cooldownUntil > t then
		tell(player, "You can lock the door again in " .. math.ceil(base.cooldownUntil - t) .. "s.", "info")
		return
	end
	base.shieldUntil = t + Config.ShieldSeconds
	base.root:SetAttribute("ShieldUntil", base.shieldUntil)
	setShieldVisual(base, true)
	sfx("lock", base.cf.Position)
	-- anyone else inside is put out the door
	for other in pairs(state) do
		local hrp = other ~= player and other.Character and other.Character:FindFirstChild("HumanoidRootPart")
		if hrp and insideBase(base, hrp.Position) then
			other.Character:PivotTo(base.cf * CFrame.new(0, 4, -base.halfD - 8))
			tell(other, "The door locked and you were put outside!", "info")
		end
	end
	tell(player, "Door locked for " .. Config.ShieldSeconds .. " seconds. Nobody can get in, you included.", "good")
	local myUntil = base.shieldUntil
	task.delay(Config.ShieldSeconds, function()
		if base.shieldUntil == myUntil then
			unlockDoor(base, "timer")
		end
	end)
end

ShieldRequest.OnServerEvent:Connect(toggleDoor)
for _, base in ipairs(map.bases) do
	base.consolePrompt.Triggered:Connect(function(who)
		if base.owner == who then
			toggleDoor(who)
		else
			tell(who, "That's not your door.", "info")
		end
	end)
end

-- ---------- bases: claim on join, free on leave ----------
local function pedestalLooks(base)
	for i, ped in ipairs(base.pedestals) do
		local locked = i > base.unlocked
		ped.part.Transparency = locked and 0.8 or 0
		ped.ring.Color = locked and Color3.fromRGB(90, 96, 116) or Config.Colors.Blue
		ped.ring.Transparency = locked and 0.6 or 0
	end
end

local function claimBase(player, d)
	for _, base in ipairs(map.bases) do
		if not base.owner then
			base.owner = player
			base.unlocked = d.pedestals
			pedestalLooks(base)
			base.shieldUntil, base.cooldownUntil = 0, 0
			base.root:SetAttribute("OwnerUserId", player.UserId)
			base.root:SetAttribute("ShieldUntil", 0)
			base.root:SetAttribute("CooldownUntil", 0)
			base.signLabel.Text = player.DisplayName .. "'s Base"
			base.nameLabel.Text = player.DisplayName .. "'s Base"
			return base
		end
	end
	return nil
end

local function freeBase(base)
	for slot, rec in pairs(base.slots) do
		rec.model:Destroy()
		base.slots[slot] = nil
	end
	base.owner = nil
	base.unlocked = Config.PedestalsPerBase
	pedestalLooks(base)
	base.shieldUntil, base.cooldownUntil = 0, 0
	setShieldVisual(base, false)
	base.root:SetAttribute("OwnerUserId", 0)
	base.signLabel.Text = "Free base"
	base.nameLabel.Text = "Free base"
end

local function onCharacter(player, character)
	local hum = character:WaitForChild("Humanoid", 10)
	if hum then
		hum.Died:Connect(function()
			dropCarried(player, "died")
		end)
	end
	local st = state[player]
	if st and st.base then -- start each life at your own base
		task.defer(function()
			local hrp = character:WaitForChild("HumanoidRootPart", 5)
			if hrp then
				character:PivotTo(st.base.cf * CFrame.new(0, 4, -10))
			end
		end)
	end
end

local function onPlayerAdded(player)
	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	local sd = Instance.new("IntValue")
	sd.Name = "Stardust"
	sd.Parent = ls
	local cr = Instance.new("IntValue")
	cr.Name = "Critters"
	cr.Parent = ls
	ls.Parent = player

	local d = PlayerData.load(player)
	if not player.Parent then
		PlayerData.release(player)
		return
	end
	state[player] = { base = claimBase(player, d), carrying = nil }
	local st = state[player]
	if st.base then
		for k, key in pairs(d.slots) do
			local def, mut = Config.fromKey(key)
			if def then
				local crit = makeCrit(def, mut)
				placeOnPedestal(st.base, tonumber(k), crit)
				d.found[crit.key] = true
			end
		end
	end
	if d.pet then
		player:SetAttribute("Pet", d.pet) -- refreshStats clears it if that critter is no longer in the base
	end
	refreshStats(player)
	player.CharacterAdded:Connect(function(ch)
		onCharacter(player, ch)
	end)
	if player.Character then
		onCharacter(player, player.Character)
	end
	tell(player, "Welcome aboard " .. Config.GameTitle .. "!", "good")
end

Players.PlayerAdded:Connect(onPlayerAdded)
for _, p in ipairs(Players:GetPlayers()) do -- anyone who joined before this script ran (Studio play-testing)
	task.spawn(onPlayerAdded, p)
end

Players.PlayerRemoving:Connect(function(player)
	local st = state[player]
	if st then
		dropCarried(player, "left")
		if st.base then
			freeBase(st.base)
		end
	end
	PlayerData.release(player)
	state[player] = nil
end)

game:BindToClose(function()
	PlayerData.saveAll()
end)

-- ---------- the launch pad ----------
local function pickCritter()
	local exclusive = {}
	for _, id in ipairs(Config.ExclusiveCritters) do
		exclusive[id] = true
	end
	local pool, total = {}, 0
	for name, r in pairs(Config.Rarities) do
		local list = {}
		for _, c in ipairs(Config.Critters) do
			if c.rarity == name and c.enabled ~= false and not exclusive[c.id] then
				table.insert(list, c)
			end
		end
		if #list > 0 then
			table.insert(pool, { weight = r.weight, list = list })
			total += r.weight
		end
	end
	local roll = math.random() * total
	for _, entry in ipairs(pool) do
		roll -= entry.weight
		if roll <= 0 then
			return entry.list[math.random(1, #entry.list)]
		end
	end
	local last = pool[#pool]
	return last.list[math.random(1, #last.list)]
end

local function rollMutation()
	local r = math.random()
	for _, m in ipairs(Config.Mutations) do -- rarest first
		if r < m.chance then
			return m
		end
		r -= m.chance
	end
	return nil
end

local FACING = CFrame.Angles(0, math.rad(-90), 0) -- critters face the way the pad moves

local function spawnOnPad()
	local def = pickCritter()
	local crit = makeCrit(def, rollMutation())
	local y = map.padY + radiusOf(def) + 0.4
	local model = CritterModels.build(def, CFrame.new(map.padStart, y, 0) * FACING, crit.mut)
	CritterModels.setInfo(model, addCommas(crit.price) .. " Stardust")
	local item = { model = model, crit = crit, x = map.padStart, y = y, t = 0, taken = false }
	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = "Grab (" .. addCommas(crit.price) .. ")"
	prompt.ObjectText = crit.name
	prompt.HoldDuration = 0
	prompt.MaxActivationDistance = 10
	prompt.RequiresLineOfSight = false
	prompt.Parent = model.PrimaryPart
	prompt.Triggered:Connect(function(who)
		tryBuy(who, item)
	end)
	model.Parent = map.critterFolder
	table.insert(conveyor, item)
	local order = Config.Rarities[def.rarity].order
	if def.family then -- one of Nolan's own friends
		tellAll("Nolan's friend " .. crit.name .. " landed on the launch pad! Quick, grab them!", "cosmic")
	elseif crit.mut and crit.mut.id == "rainbow" then
		tellAll("A RAINBOW critter landed on the launch pad: " .. crit.name .. "!", "cosmic")
	elseif order >= 4 then
		tellAll("A " .. def.rarity:upper() .. " critter landed on the launch pad: " .. crit.name .. "!", def.rarity == "Cosmic" and "cosmic" or "rare")
	end
end

RunService.Heartbeat:Connect(function(dt)
	for i = #conveyor, 1, -1 do
		local item = conveyor[i]
		if item.taken then
			table.remove(conveyor, i)
		else
			item.x += Config.ConveyorSpeed * dt
			item.t += dt
			if item.x > map.padEnd then
				item.model:Destroy()
				table.remove(conveyor, i)
			else
				item.model:PivotTo(CFrame.new(item.x, item.y + math.sin(item.t * 3) * 0.25, 0) * FACING)
			end
		end
	end
end)

task.spawn(function()
	while true do
		spawnOnPad()
		task.wait(Config.SpawnEvery)
	end
end)

-- ---------- Stardust stars and the Meteor Shower ----------
local starFolder = Instance.new("Folder")
starFolder.Name = "Stars"
starFolder.Parent = stationFolder
local stars = {} -- [part] = { bonus = n, shower = bool }
local rng = Random.new()

local function freeSpot()
	for _ = 1, 30 do
		local x, z = rng:NextNumber(-218, 218), rng:NextNumber(-140, 140)
		local ok = not (math.abs(z) < 12 and math.abs(x) < 72) -- not on the launch pad
		for _, base in ipairs(map.bases) do
			local p = base.cf:PointToObjectSpace(Vector3.new(x, 0, z))
			if math.abs(p.X) < base.halfW + 3 and math.abs(p.Z) < base.halfD + 3 then
				ok = false
			end
		end
		if ok then
			return Vector3.new(x, 2.6, z)
		end
	end
	return Vector3.new(rng:NextNumber(-60, 60), 2.6, 30)
end

local function makeStar(pos, shower)
	local s = Instance.new("Part")
	s.Name = "Star"
	s.Shape = Enum.PartType.Ball
	s.Size = shower and Vector3.new(2.6, 2.6, 2.6) or Vector3.new(2.1, 2.1, 2.1)
	s.Color = shower and Config.Colors.Blue or Config.Colors.Orange
	s.Material = Enum.Material.Neon
	s.Anchored = true
	s.CanCollide = false
	s.CanQuery = false
	s.CanTouch = false
	s.CFrame = CFrame.new(pos)
	local light = Instance.new("PointLight")
	light.Color = s.Color
	light.Range = 9
	light.Brightness = 1.6
	light.Parent = s
	s.Parent = starFolder
	return s
end

local function spawnStar()
	local s = makeStar(freeSpot(), false)
	s:SetAttribute("Ready", true)
	stars[s] = { bonus = 1, shower = false }
end

for _ = 1, Config.Stars.count do
	spawnStar()
end

local function collect(player, s, info)
	stars[s] = nil
	local d = PlayerData.get(player)
	local st = state[player]
	if d then
		local value = math.max(Config.Stars.value, math.floor(incomeOf(st) * Config.Stars.incomeFactor)) * info.bonus
		d.stardust += value
		refreshStats(player)
		FX:FireClient(player, "pop", s.Position, "+" .. addCommas(value) .. " ★")
	end
	FX:FireAllClients("burst", s.Position, s.Color)
	s:Destroy()
	if not info.shower then
		task.delay(rng:NextNumber(Config.Stars.respawnMin, Config.Stars.respawnMax), spawnStar)
	end
end

task.spawn(function()
	local reach = Config.Stars.pickupDistance
	while true do
		task.wait(0.12)
		for player in pairs(state) do
			local hrp = rootOf(player)
			if hrp then
				local p = hrp.Position
				for s, info in pairs(stars) do
					if s.Parent and s:GetAttribute("Ready") and (s.Position - p).Magnitude <= reach then
						collect(player, s, info)
					end
				end
			end
		end
	end
end)

local function meteorStar()
	local land = freeSpot()
	local s = makeStar(land + Vector3.new(rng:NextNumber(-40, 40), 160, rng:NextNumber(-40, 40)), true)
	stars[s] = { bonus = Config.MeteorStarBonus, shower = true }
	local tw = TweenService:Create(s, TweenInfo.new(1.4, Enum.EasingStyle.Quad, Enum.EasingDirection.In), { CFrame = CFrame.new(land) })
	tw:Play()
	tw.Completed:Connect(function()
		if s.Parent then
			s:SetAttribute("Ready", true)
			FX:FireAllClients("burst", land, Config.Colors.Blue)
			task.delay(25, function() -- uncollected shower stars fade away
				if s.Parent then
					stars[s] = nil
					s:Destroy()
				end
			end)
		end
	end)
end

task.spawn(function()
	task.wait(Config.MeteorFirst)
	while true do
		tellAll("METEOR SHOWER! Grab the falling stars, they're worth double!", "cosmic")
		FX:FireAllClients("shower", Config.MeteorSeconds)
		local t0 = os.clock()
		while os.clock() - t0 < Config.MeteorSeconds do
			meteorStar()
			task.wait(1 / Config.MeteorPerSecond)
		end
		task.wait(Config.MeteorEvery)
	end
end)

Drop.OnServerEvent:Connect(function(player)
	local st = state[player]
	if st and st.carrying then
		local at = st.carrying.model and st.carrying.model.PrimaryPart and st.carrying.model:GetPivot().Position
		dropCarried(player, "dropped")
		if at then
			FX:FireAllClients("burst", at, Config.Colors.Blue)
		end
	end
end)

-- ---------- expand your base: two more pedestals at a time ----------
Expand.OnServerEvent:Connect(function(player)
	local st = state[player]
	local d = PlayerData.get(player)
	if not (st and d and st.base) then
		return
	end
	local cost = Config.ExpandCosts[(st.base.unlocked - Config.PedestalsPerBase) / 2 + 1]
	if not cost then
		tell(player, "Your base is as big as it gets!", "info")
		return
	end
	if d.stardust < cost then
		tell(player, "Expanding costs " .. addCommas(cost) .. " Stardust. You need " .. addCommas(cost - d.stardust) .. " more.", "bad")
		return
	end
	d.stardust -= cost
	d.pedestals = math.min(Config.MaxPedestals, d.pedestals + 2)
	st.base.unlocked = d.pedestals
	pedestalLooks(st.base)
	refreshStats(player)
	FX:FireAllClients("confetti", st.base.cf.Position + Vector3.new(0, 4, 0))
	tell(player, "Base expanded! You have " .. d.pedestals .. " pedestals now.", "good")
end)

-- ---------- the pet that follows you (each screen draws it; Pets.client.lua) ----------
SetPet.OnServerEvent:Connect(function(player, key)
	local st = state[player]
	local d = PlayerData.get(player)
	if not (st and d) then
		return
	end
	if key == nil or key == "" then
		player:SetAttribute("Pet", nil)
		d.pet = nil
		return
	end
	if typeof(key) ~= "string" or not st.base then
		return
	end
	for _, rec in pairs(st.base.slots) do
		if rec.crit.key == key then
			player:SetAttribute("Pet", key)
			d.pet = key
			tell(player, rec.crit.name .. " is following you now!", "good")
			return
		end
	end
	tell(player, "That critter needs to be in your base to be your pet.", "info")
end)

-- ---------- Black Hole Night: lights out, the Void Creeper roams, hide in a locker ----------
local Lighting = game:GetService("Lighting")
local hidden = {} -- [player] = locker
local lockerUser = {} -- [locker] = player

local function unhide(player)
	local lk = hidden[player]
	if not lk then
		return
	end
	hidden[player] = nil
	lockerUser[lk] = nil
	lk.strip.Color = Config.Colors.Blue
	lk.prompt.ActionText = "Hide"
	local ch = player.Character
	local hrp = ch and ch:FindFirstChild("HumanoidRootPart")
	if hrp then
		hrp.Anchored = false
		ch:PivotTo(lk.front)
	end
end

for _, lk in ipairs(map.lockers or {}) do
	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = "Hide"
	prompt.ObjectText = "Locker"
	prompt.HoldDuration = 0
	prompt.MaxActivationDistance = 7
	prompt.RequiresLineOfSight = false
	prompt.Parent = lk.body
	lk.prompt = prompt
	prompt.Triggered:Connect(function(player)
		if hidden[player] == lk then
			unhide(player)
			return
		end
		if lockerUser[lk] then
			tell(player, "Someone's already hiding in there!", "info")
			return
		end
		if hidden[player] then
			unhide(player)
		end
		local ch = player.Character
		local hrp = ch and ch:FindFirstChild("HumanoidRootPart")
		if not hrp then
			return
		end
		hidden[player] = lk
		lockerUser[lk] = player
		ch:PivotTo(lk.inside)
		hrp.Anchored = true
		lk.strip.Color = Config.Colors.Orange
		prompt.ActionText = "Come out"
		tell(player, "You're hiding! Press E again to come out.", "info")
	end)
end

task.spawn(function() -- a hider who reset or respawned frees their locker
	while true do
		task.wait(1)
		for player, lk in pairs(hidden) do
			local hrp = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
			if not (hrp and hrp.Anchored) then
				hidden[player] = nil
				lockerUser[lk] = nil
				lk.strip.Color = Config.Colors.Blue
				lk.prompt.ActionText = "Hide"
			end
		end
	end
end)

Players.PlayerRemoving:Connect(function(player)
	local lk = hidden[player]
	if lk then
		lockerUser[lk] = nil
		hidden[player] = nil
		lk.strip.Color = Config.Colors.Blue
		lk.prompt.ActionText = "Hide"
	end
end)

local function buildCreeper(at)
	local m = Instance.new("Model")
	m.Name = "VoidCreeper"
	local body = Instance.new("Part")
	body.Name = "Body"
	body.Shape = Enum.PartType.Ball
	body.Size = Vector3.new(7, 7, 7)
	body.Color = Color3.fromRGB(40, 20, 60)
	body.Material = Enum.Material.SmoothPlastic
	body.Anchored = true
	body.CanCollide = false
	body.CanQuery = false
	body.CFrame = at
	body.Parent = m
	m.PrimaryPart = body
	local function bit(name, size, color, offset, neon)
		local p = Instance.new("Part")
		p.Name = name
		p.Shape = Enum.PartType.Ball
		p.Size = size
		p.Color = color
		p.Material = neon and Enum.Material.Neon or Enum.Material.SmoothPlastic
		p.Anchored = false
		p.CanCollide = false
		p.CanQuery = false
		p.Massless = true
		p.CFrame = body.CFrame * offset
		local w = Instance.new("WeldConstraint")
		w.Part0 = body
		w.Part1 = p
		w.Parent = p
		p.Parent = m
	end
	for _, side in ipairs({ -1, 1 }) do -- big goofy glowing eyes
		bit("Eye", Vector3.new(1.8, 2.2, 1), Color3.fromRGB(240, 255, 255), CFrame.new(side * 1.3, 0.9, -3.0), true)
		bit("Pupil", Vector3.new(0.7, 0.9, 0.4), Color3.fromRGB(150, 60, 255), CFrame.new(side * 1.3, 0.8, -3.45), true)
	end
	bit("Mouth", Vector3.new(3, 0.8, 0.6), Color3.fromRGB(150, 60, 255), CFrame.new(0, -1.4, -3.1), true)
	for i = 1, 3 do -- a wobbly tail of shrinking blobs
		bit("Tail" .. i, Vector3.new(4.5, 4.5, 4.5) * (1 - i * 0.22), Color3.fromRGB(55, 28, 80), CFrame.new(0, -0.8 * i, 3 + i * 2.2))
	end
	local light = Instance.new("PointLight")
	light.Color = Color3.fromRGB(170, 80, 255)
	light.Range = 22
	light.Brightness = 3
	light.Parent = body
	local smoke = Instance.new("ParticleEmitter")
	smoke.Color = ColorSequence.new(Color3.fromRGB(90, 40, 140), Color3.fromRGB(20, 10, 30))
	smoke.Size = NumberSequence.new(2.5, 5)
	smoke.Transparency = NumberSequence.new(0.4, 1)
	smoke.Lifetime = NumberRange.new(1, 1.8)
	smoke.Rate = 20
	smoke.Speed = NumberRange.new(1, 3)
	smoke.Parent = body
	local tag = Instance.new("BillboardGui")
	tag.Size = UDim2.fromOffset(220, 40)
	tag.StudsOffsetWorldSpace = Vector3.new(0, 6, 0)
	tag.LightInfluence = 0
	tag.Parent = body
	local l = Instance.new("TextLabel")
	l.Size = UDim2.fromScale(1, 1)
	l.BackgroundTransparency = 1
	l.Font = Enum.Font.FredokaOne
	l.TextScaled = true
	l.TextColor3 = Color3.fromRGB(200, 140, 255)
	l.TextStrokeTransparency = 0.2
	l.Text = "Void Creeper"
	l.Parent = tag
	m.Parent = stationFolder
	return m
end

local nightLighting = { Ambient = Color3.fromRGB(28, 16, 48), OutdoorAmbient = Color3.fromRGB(34, 20, 60), Brightness = 0.25 }
local function setNight(on)
	local cc = Lighting:FindFirstChildOfClass("ColorCorrectionEffect")
	if on then
		Lighting:SetAttribute("DayAmbient", Lighting.Ambient)
		Lighting:SetAttribute("DayOutdoor", Lighting.OutdoorAmbient)
		Lighting:SetAttribute("DayBrightness", Lighting.Brightness)
		TweenService:Create(Lighting, TweenInfo.new(2.5), nightLighting):Play()
		if cc then
			TweenService:Create(cc, TweenInfo.new(2.5), { TintColor = Color3.fromRGB(190, 160, 255) }):Play()
		end
	else
		TweenService:Create(Lighting, TweenInfo.new(2.5), {
			Ambient = Lighting:GetAttribute("DayAmbient") or Color3.fromRGB(70, 80, 115),
			OutdoorAmbient = Lighting:GetAttribute("DayOutdoor") or Color3.fromRGB(90, 100, 140),
			Brightness = Lighting:GetAttribute("DayBrightness") or 1.2,
		}):Play()
		if cc then
			TweenService:Create(cc, TweenInfo.new(2.5), { TintColor = Color3.new(1, 1, 1) }):Play()
		end
	end
end

local function blackHoleNight()
	workspace:SetAttribute("BlackHoleUntil", now() + Config.NightSeconds)
	tellAll("BLACK HOLE NIGHT! The Void Creeper is loose. Hide in a locker or run!", "cosmic")
	FX:FireAllClients("night", Config.NightSeconds)
	setNight(true)
	local creeper = buildCreeper(CFrame.new(-60, 40, 0))
	local pos = Vector3.new(-60, 40, 0)
	local ignore = {} -- [player] = time it can chase them again
	local pauseUntil = 0
	local wander = Vector3.new(0, 5, 0)
	local t0 = os.clock()
	local conn
	conn = RunService.Heartbeat:Connect(function(dt)
		if os.clock() - t0 > Config.NightSeconds then
			return
		end
		local t = os.clock()
		-- chase the nearest player who isn't hiding
		local target, best = nil, math.huge
		for player in pairs(state) do
			local hrp = rootOf(player)
			if hrp and not hidden[player] and (ignore[player] or 0) < t then
				local dist = (hrp.Position - pos).Magnitude
				if dist < best then
					target, best = hrp, dist
				end
			end
		end
		local goal
		if target and best < 160 then
			goal = Vector3.new(target.Position.X, 4.5, target.Position.Z)
		else
			if (wander - pos).Magnitude < 4 then
				wander = Vector3.new(rng:NextNumber(-200, 200), 4.5, rng:NextNumber(-130, 130))
			end
			goal = wander
		end
		if t > pauseUntil then
			local step = goal - pos
			local speed = (pos.Y > 6) and 30 or Config.CreeperSpeed -- swoops down fast at the start
			if step.Magnitude > 0.1 then
				pos += step.Unit * math.min(step.Magnitude, speed * dt)
			end
		end
		local look = target and Vector3.new(target.Position.X, pos.Y, target.Position.Z) or (pos + Vector3.new(0, 0, -1))
		if (look - pos).Magnitude < 0.1 then
			look = pos + Vector3.new(0, 0, -1)
		end
		creeper:PivotTo(CFrame.lookAt(pos + Vector3.new(0, math.sin(t * 4) * 0.6, 0), look))
		-- boop! anyone it reaches drops what they carry and is sent back to their base
		for player, st in pairs(state) do
			local hrp = rootOf(player)
			if hrp and not hidden[player] and (ignore[player] or 0) < t and (hrp.Position - pos).Magnitude <= Config.CreeperReach then
				ignore[player] = t + 6
				pauseUntil = t + 1.5
				if st.carrying then
					dropCarried(player, "creeper")
				end
				FX:FireClient(player, "booped")
				tell(player, "The Void Creeper booped you back to your base!", "bad")
				if st.base and player.Character then
					player.Character:PivotTo(st.base.cf * CFrame.new(0, 4, -10))
				end
			end
		end
	end)
	task.wait(Config.NightSeconds)
	conn:Disconnect()
	creeper:Destroy()
	setNight(false)
	workspace:SetAttribute("BlackHoleUntil", 0)
	tellAll("The lights are back on. The Void Creeper has gone... for now.", "good")
end

if Config.BlackHoleNight then
	task.spawn(function()
		task.wait(Config.NightFirst)
		while true do
			blackHoleNight()
			task.wait(Config.NightEvery)
		end
	end)
end

-- ---------- punching, critters on the floor, Parker Bots (2026-10-18, Matthew; named Parker Bots the same day) ----------
local Punch = remote("Punch")
local floorItems = {} -- [model] = { crit, owner, slot, expires }
local bots = {}

local function sendHome(player)
	local st = state[player]
	if st and st.base and player.Character then
		player.Character:PivotTo(st.base.cf * CFrame.new(0, 4, -10))
	end
end

local function slotFor(base, want)
	if want and want <= base.unlocked and not base.slots[want] then
		return want
	end
	return freeSlot(base)
end

-- an unclaimed critter on the floor goes back to whoever it belonged to
local function returnToOwner(item)
	local owner = item.owner
	local ost = owner and state[owner]
	local od = owner and PlayerData.get(owner)
	if not (ost and ost.base and od) then
		return false
	end
	local slot = slotFor(ost.base, item.slot)
	if not slot then
		return false
	end
	placeOnPedestal(ost.base, slot, item.crit)
	od.slots[tostring(slot)] = item.crit.key
	refreshStats(owner)
	tell(owner, "Your " .. item.crit.name .. " came back home!", "good")
	return true
end

local function putOnFloor(model, crit, owner, slot, pos)
	local body = model.PrimaryPart
	local w = body:FindFirstChild("CarryWeld")
	if w then
		w:Destroy()
	end
	body.Anchored = true
	model:PivotTo(CFrame.new(pos.X, 1.2 + radiusOf(crit.def), pos.Z))
	CritterModels.setInfo(model, "Knocked loose! Grab it!")
	local item = { model = model, crit = crit, owner = owner, slot = slot, expires = os.clock() + Config.Punch.floorSeconds }
	floorItems[model] = item
	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = "Grab"
	prompt.ObjectText = crit.name
	prompt.HoldDuration = 0
	prompt.MaxActivationDistance = 10
	prompt.RequiresLineOfSight = false
	prompt.Parent = body
	prompt.Triggered:Connect(function(who)
		if floorItems[model] ~= item then
			return
		end
		local st = state[who]
		if not st then
			return
		end
		if st.carrying then
			tell(who, "Your hands are full!", "bad")
			return
		end
		if who == item.owner and st.base then -- your own critter: straight back home
			local s2 = slotFor(st.base, item.slot)
			if s2 then
				floorItems[model] = nil
				local at = model:GetPivot().Position
				model:Destroy()
				placeOnPedestal(st.base, s2, crit)
				local od = PlayerData.get(who)
				if od then
					od.slots[tostring(s2)] = crit.key
				end
				refreshStats(who)
				FX:FireAllClients("confetti", at)
				tell(who, "You got your " .. crit.name .. " back! It's home again.", "good")
				return
			end
		end
		if not (st.base and freeSlot(st.base)) then
			tell(who, "Your base is full!", "bad")
			return
		end
		floorItems[model] = nil
		if not attach(who, model, crit, { owner = item.owner, slot = item.slot }) then
			floorItems[model] = item
			return
		end
		tell(who, "Grabbed " .. crit.name .. "! Get it to your base!", "good")
	end)
end

-- returns true when the victim was carrying something and it fell
local function knockOff(victim)
	local st = state[victim]
	local c = st and st.carrying
	if not c then
		return false
	end
	local hrp = rootOf(victim)
	clearCarry(victim)
	local owner = (c.from and c.from.owner) or victim -- a bought one still belongs to the buyer
	local pos = hrp and (hrp.Position - hrp.CFrame.LookVector * 3) or c.model:GetPivot().Position
	putOnFloor(c.model, c.crit, owner, c.from and c.from.slot or nil, pos)
	return true
end

task.spawn(function()
	while true do
		task.wait(1)
		local t = os.clock()
		for model, item in pairs(floorItems) do
			if t > item.expires then
				floorItems[model] = nil
				returnToOwner(item)
				model:Destroy()
			end
		end
	end
end)

-- ---------- the Gear Bay: buying gear, and handing it out every time you spawn (2026-10-18, Matthew) ----------
local GearTools = require(script.Parent.GearTools)

local function hasTool(player, id)
	for _, holder in ipairs({ player:FindFirstChildOfClass("Backpack"), player.Character }) do
		if holder then
			for _, t in ipairs(holder:GetChildren()) do
				if t:IsA("Tool") and t:GetAttribute("GearId") == id then
					return true
				end
			end
		end
	end
	return false
end

local function giveGear(player)
	local d = PlayerData.get(player)
	local ch = player.Character
	if not (d and ch) then
		return
	end
	for _, g in ipairs(Config.Gear) do
		if d.gear[g.id] then
			player:SetAttribute("Owns_" .. g.id, true) -- the Gear Bay prompts read this on your screen
			if g.kind == "weapon" then
				local backpack = player:FindFirstChildOfClass("Backpack")
				if backpack and not hasTool(player, g.id) then
					local t = GearTools.tool(g.id)
					if t then
						t.Parent = backpack
					end
				end
			elseif g.id == "boots" then
				ch:SetAttribute("JetBoots", g.boost) -- every screen draws the flames; your own screen does the boost
				local hum = ch:FindFirstChildOfClass("Humanoid")
				if hum then
					hum.UseJumpPower = false
					hum.JumpHeight = g.jumpHeight
				end
				GearTools.fitBoots(ch)
			end
		end
	end
end

local function onGearCharacter(player, ch)
	task.spawn(function()
		ch:WaitForChild("Humanoid", 10)
		local t0 = os.clock()
		while player.Parent and ch.Parent and os.clock() - t0 < 10 and not (PlayerData.get(player) and player:HasAppearanceLoaded()) do
			task.wait(0.25) -- wait for the save to load and the avatar's body parts to settle, so the boots stay on
		end
		if player.Parent and ch.Parent then
			giveGear(player)
		end
	end)
end
local function hookGear(player)
	player.CharacterAdded:Connect(function(ch)
		onGearCharacter(player, ch)
	end)
	if player.Character then
		onGearCharacter(player, player.Character)
	end
end
Players.PlayerAdded:Connect(hookGear)
for _, p in ipairs(Players:GetPlayers()) do
	hookGear(p)
end

for id, stand in pairs(map.gearStands or {}) do
	local def = Config.gearById(id)
	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = "Buy (" .. addCommas(def.price) .. " ★)"
	prompt.ObjectText = def.name
	prompt.HoldDuration = 0.4
	prompt.MaxActivationDistance = 10
	prompt.RequiresLineOfSight = false
	prompt:SetAttribute("GearId", id)
	prompt.Parent = stand
	prompt.Triggered:Connect(function(player)
		local d = PlayerData.get(player)
		if not d then
			return
		end
		if d.gear[id] then
			giveGear(player)
			tell(player, def.kind == "weapon" and ("Your " .. def.name .. " is in your backpack.") or ("Your " .. def.name .. " are on!"), "info")
			return
		end
		if d.stardust < def.price then
			tell(player, "The " .. def.name .. " costs " .. addCommas(def.price) .. " Stardust. Keep collecting!", "bad")
			return
		end
		d.stardust -= def.price
		d.gear[id] = true
		refreshStats(player)
		giveGear(player)
		sfx("gear", nil, player)
		FX:FireAllClients("confetti", stand.Position + Vector3.new(0, 5, 0))
		if def.kind == "weapon" then
			tell(player, "You got the " .. def.name .. "! Pick it in your backpack, then use it with Q, a click, or the " .. def.button .. " button.", "good")
		else
			tell(player, "You got the " .. def.name .. "! Jump, then jump again in the air for a rocket boost.", "good")
		end
	end)
end

-- the nearest player or Parker Bot within reach and roughly in front
local function findTarget(player, hrp, reach, minDot)
	local look = hrp.CFrame.LookVector
	local best, bestD, kind, pos = nil, math.huge, nil, nil
	for other in pairs(state) do
		local oh = other ~= player and not hidden[other] and rootOf(other)
		if oh then
			local v = oh.Position - hrp.Position
			local d = v.Magnitude
			if d <= reach and d < bestD and (d < 1.5 or v.Unit:Dot(look) > minDot) then
				best, bestD, kind, pos = other, d, "player", oh.Position
			end
		end
	end
	for _, bot in ipairs(bots) do
		local v = bot.pos - hrp.Position
		local d = v.Magnitude
		if d <= reach + 2 and d < bestD and (d < 1.5 or v.Unit:Dot(look) > minDot - 0.1) then
			best, bestD, kind, pos = bot, d, "bot", bot.pos
		end
	end
	return best, kind, pos
end

-- what a landed hit does, from a fist, the glove or a star bolt
local function hit(player, hrp, best, kind, knockMul, stun)
	if kind == "bot" then
		best.stunUntil = os.clock() + stun
		FX:FireAllClients("pow", best.pos)
		tell(player, "Parker Bot stunned!", "good")
		return
	end
	local oh = rootOf(best)
	if not oh then
		return
	end
	FX:FireAllClients("pow", oh.Position)
	local dir = (oh.Position - hrp.Position) * Vector3.new(1, 0, 1)
	if dir.Magnitude < 0.1 then
		dir = hrp.CFrame.LookVector
	end
	FX:FireClient(best, "knock", dir.Unit * knockMul)
	if knockOff(best) then
		tell(best, player.DisplayName .. " knocked your critter loose!", "bad")
		tell(player, "Knocked it loose! Grab it!", "good")
	end
end

local lastPunch = {}
Punch.OnServerEvent:Connect(function(player)
	local ch = player.Character
	local tool = ch and ch:FindFirstChildOfClass("Tool")
	local gid = tool and tool:GetAttribute("GearId")
	local g = gid and Config.gearById(gid)
	local d = PlayerData.get(player)
	if g and not (d and d.gear[gid]) then
		g, gid = nil, nil
	end
	local t = os.clock()
	if (lastPunch[player] or 0) + (g and g.cooldown or Config.Punch.cooldown) > t then
		return
	end
	lastPunch[player] = t
	local hrp = rootOf(player)
	if not hrp or hidden[player] then
		return
	end
	local look = hrp.CFrame.LookVector

	if gid == "blaster" then -- a star bolt at whoever is in front, stopped by walls and locked doors
		local best, kind, pos = findTarget(player, hrp, g.range, 0.85)
		local muzzle = tool:FindFirstChild("Handle") and tool.Handle:FindFirstChild("Muzzle")
		local from = muzzle and muzzle.WorldPosition or (hrp.Position + look * 3)
		local to = pos or (from + look * g.range)
		local ignore = { map.critterFolder }
		for p in pairs(state) do
			if p.Character then
				table.insert(ignore, p.Character)
			end
		end
		for _, bot in ipairs(bots) do
			table.insert(ignore, bot.model)
		end
		local params = RaycastParams.new()
		params.FilterType = Enum.RaycastFilterType.Exclude
		params.FilterDescendantsInstances = ignore
		local ray = workspace:Raycast(from, to - from, params)
		if ray then
			to, best = ray.Position, nil
		end
		FX:FireAllClients("blast", player, from, to, best ~= nil)
		if best then
			hit(player, hrp, best, kind, g.knock, g.stun)
		end
		return
	end

	local best, kind = findTarget(player, hrp, g and g.reach or Config.Punch.reach, 0.2)
	FX:FireAllClients("swing", hrp.Position + look * 3, player, gid or "fist")
	if best then
		hit(player, hrp, best, kind, g and g.knock or 1, g and g.stun or Config.Bots.stunSeconds)
	end
end)

-- the patrol route: along both walkways, up and back down every lane to a base
local route = {}
local lanes = { -171, -57, 57, 171 }
for _, side in ipairs({ 1, -1 }) do
	local xs = side == 1 and lanes or { 171, 57, -57, -171 }
	for _, x in ipairs(xs) do
		table.insert(route, Vector3.new(x, 3.5, 22 * side))
		table.insert(route, Vector3.new(x, 3.5, 62 * side))
		table.insert(route, Vector3.new(x, 3.5, 22 * side))
	end
end

local function buildBot(i, at)
	local m = Instance.new("Model")
	m.Name = "ParkerBot" .. i
	local body = Instance.new("Part")
	body.Name = "Body"
	body.Size = Vector3.new(3, 3.2, 2.6)
	body.Color = Color3.fromRGB(88, 96, 122)
	body.Material = Enum.Material.Metal
	body.Anchored = true
	body.CanCollide = false
	body.CanQuery = false
	body.CFrame = CFrame.new(at)
	body.Parent = m
	m.PrimaryPart = body
	local function bit(name, size, color, offset, opts)
		opts = opts or {}
		local p = Instance.new("Part")
		p.Name = name
		p.Size = size
		p.Color = color
		p.Material = opts.neon and Enum.Material.Neon or Enum.Material.Metal
		if opts.ball then
			p.Shape = Enum.PartType.Ball
		elseif opts.cyl then
			p.Shape = Enum.PartType.Cylinder
		end
		p.Anchored = false
		p.CanCollide = false
		p.CanQuery = false
		p.Massless = true
		p.CFrame = body.CFrame * offset
		local w = Instance.new("WeldConstraint")
		w.Part0 = body
		w.Part1 = p
		w.Parent = p
		p.Parent = m
		return p
	end
	bit("Head", Vector3.new(2.4, 1.6, 2.2), Color3.fromRGB(110, 118, 146), CFrame.new(0, 2.4, 0))
	local eye = bit("Visor", Vector3.new(2.0, 0.55, 0.2), Color3.fromRGB(255, 80, 80), CFrame.new(0, 2.5, -1.12), { neon = true })
	bit("Antenna", Vector3.new(0.2, 1, 0.2), Color3.fromRGB(60, 64, 82), CFrame.new(0, 3.7, 0))
	local siren = bit("Siren", Vector3.new(0.7, 0.7, 0.7), Color3.fromRGB(80, 140, 255), CFrame.new(0, 4.3, 0), { neon = true, ball = true })
	bit("Badge", Vector3.new(1.2, 0.8, 0.12), Config.Colors.Orange, CFrame.new(0, 0.4, -1.32), { neon = true })
	for _, side in ipairs({ -1, 1 }) do
		bit("Arm", Vector3.new(0.6, 2.2, 0.6), Color3.fromRGB(70, 76, 98), CFrame.new(side * 1.85, 0, 0) * CFrame.Angles(0, 0, side * 0.2))
	end
	local jet = bit("Thruster", Vector3.new(0.6, 1.8, 1.8), Config.Colors.Blue, CFrame.new(0, -1.9, 0) * CFrame.Angles(0, 0, math.rad(90)), { neon = true, cyl = true })
	local flame = Instance.new("ParticleEmitter")
	flame.Color = ColorSequence.new(Config.Colors.Blue)
	flame.LightEmission = 1
	flame.Size = NumberSequence.new(0.8, 0)
	flame.Lifetime = NumberRange.new(0.2, 0.4)
	flame.Rate = 30
	flame.Speed = NumberRange.new(4, 6)
	flame.EmissionDirection = Enum.NormalId.Left -- after the quarter turn the cylinder's -X points down
	flame.Parent = jet
	local light = Instance.new("PointLight")
	light.Color = Color3.fromRGB(255, 90, 90)
	light.Range = 14
	light.Parent = siren
	local tag = Instance.new("BillboardGui")
	tag.Size = UDim2.fromOffset(160, 34)
	tag.StudsOffsetWorldSpace = Vector3.new(0, 5.5, 0)
	tag.MaxDistance = 70
	tag.LightInfluence = 0
	tag.Parent = body
	local l = Instance.new("TextLabel")
	l.Size = UDim2.fromScale(1, 1)
	l.BackgroundTransparency = 1
	l.Font = Enum.Font.FredokaOne
	l.TextScaled = true
	l.TextColor3 = Color3.fromRGB(255, 120, 120)
	l.TextStrokeTransparency = 0.2
	l.Text = "Parker Bot"
	l.Parent = tag
	m.Parent = stationFolder
	return { model = m, eye = eye, siren = siren, light = light, label = l }
end

for i = 1, Config.Bots.count do
	local wp = math.floor((i - 1) * #route / Config.Bots.count) + 1
	local b = buildBot(i, route[wp])
	b.pos, b.wp, b.look, b.stunUntil, b.phase = route[wp], wp % #route + 1, Vector3.new(0, 0, -1), 0, i * 2
	table.insert(bots, b)
end

RunService.Heartbeat:Connect(function(dt)
	local t = os.clock()
	for _, bot in ipairs(bots) do
		local stunned = t < bot.stunUntil
		local chasing = nil
		if not stunned then
			local goal, speed
			local bd = Config.Bots.sight
			for player, st in pairs(state) do
				local hrp = rootOf(player)
				if st.carrying and hrp and not hidden[player] then
					local safe = false
					for _, b in ipairs(map.bases) do
						if insideBase(b, hrp.Position) then
							safe = true
						end
					end
					local d = (hrp.Position - bot.pos).Magnitude
					if not safe and d < bd then
						chasing, bd = player, d
					end
				end
			end
			if chasing and bot.target ~= chasing then
				sfx("bot", bot.pos)
			end
			bot.target = chasing
			if chasing then
				local hp = rootOf(chasing).Position
				goal, speed = Vector3.new(hp.X, 3.5, hp.Z), Config.Bots.chaseSpeed
				if bd <= Config.Bots.reach then -- caught: it takes the critter and zaps them home
					bot.stunUntil = t + 1.5
					dropCarried(chasing, "bot")
					sendHome(chasing)
					FX:FireClient(chasing, "zapped")
					tell(chasing, "A Parker Bot took your critter and zapped you back to base!", "bad")
				end
			else
				local wp = route[bot.wp]
				goal, speed = wp, Config.Bots.speed
				if (wp - bot.pos).Magnitude < 2 then
					bot.wp = bot.wp % #route + 1
				end
			end
			local step = goal - bot.pos
			if step.Magnitude > 0.05 then
				bot.pos += step.Unit * math.min(step.Magnitude, speed * dt)
				bot.look = Vector3.new(step.X, 0, step.Z).Magnitude > 0.05 and Vector3.new(step.X, 0, step.Z).Unit or bot.look
			end
		end
		local wobble = stunned and CFrame.Angles(math.sin(t * 20) * 0.15, 0, math.cos(t * 17) * 0.15) or CFrame.new()
		bot.model:PivotTo(CFrame.lookAt(bot.pos + Vector3.new(0, math.sin(t * 3 + bot.phase) * 0.3, 0), bot.pos + bot.look) * wobble)
		local red, blue = Color3.fromRGB(255, 60, 60), Color3.fromRGB(80, 140, 255)
		bot.siren.Color = stunned and Color3.fromRGB(90, 90, 100) or (chasing and ((math.floor(t * 6) % 2 == 0) and red or blue) or blue)
		bot.eye.Color = stunned and Color3.fromRGB(80, 80, 90) or red
		bot.label.Text = stunned and "Parker Bot (stunned!)" or (chasing and "Parker Bot: STOP!" or "Parker Bot")
	end
end)

-- ---------- the Moon Rover (2026-10-18, Matthew: "make it so you can drive the rover") ----------
-- Walk up and press E (or tap Drive) to get in; WASD or the joystick drives, Jump gets out. The driver's own screen steers it
-- (Rover.client.lua), so it feels instant. No critters in the rover: it's faster than the Parker Bots, so stealing by rover
-- would be too easy. Left alone away from its spot, it drives itself home after a while.
local PhysicsService = game:GetService("PhysicsService")
pcall(function()
	PhysicsService:RegisterCollisionGroup("Rover")
	PhysicsService:RegisterCollisionGroup("Players")
	PhysicsService:CollisionGroupSetCollidable("Rover", "Players", false) -- it never runs anyone over
end)
local function playerGroup(ch)
	for _, p in ipairs(ch:GetDescendants()) do
		if p:IsA("BasePart") then
			p.CollisionGroup = "Players"
		end
	end
	ch.DescendantAdded:Connect(function(p)
		if p:IsA("BasePart") then
			p.CollisionGroup = "Players"
		end
	end)
end
local function hookGroup(player)
	player.CharacterAdded:Connect(playerGroup)
	if player.Character then
		playerGroup(player.Character)
	end
end
Players.PlayerAdded:Connect(hookGroup)
for _, p in ipairs(Players:GetPlayers()) do
	hookGroup(p)
end

local rover = map.rover
local roverSeat = rover and rover:FindFirstChild("DriverSeat")
if rover and roverSeat and rover.PrimaryPart then
	local hull = rover.PrimaryPart
	local home = rover:GetPivot()
	local lv = hull:FindFirstChildOfClass("LinearVelocity")
	local turn = hull:FindFirstChildOfClass("AlignOrientation")
	for _, p in ipairs(rover:GetDescendants()) do
		if p:IsA("BasePart") then
			p.CollisionGroup = "Rover"
		end
	end
	pcall(function()
		hull:SetNetworkOwner(nil)
	end)
	local lastUsed = os.clock()

	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = "Drive"
	prompt.ObjectText = "Moon Rover"
	prompt.HoldDuration = 0
	prompt.MaxActivationDistance = 10
	prompt.RequiresLineOfSight = false
	prompt.Parent = roverSeat
	prompt.Triggered:Connect(function(player)
		local st = state[player]
		local hum = player.Character and player.Character:FindFirstChildOfClass("Humanoid")
		if not hum or roverSeat.Occupant then
			return
		end
		if st and st.carrying then
			tell(player, "No critters in the rover! Take it to your base first.", "bad")
			return
		end
		roverSeat:Sit(hum)
	end)

	local function stop()
		if lv then
			lv.VectorVelocity = Vector3.zero
		end
		if turn then
			local _, yaw = hull.CFrame:ToEulerAnglesYXZ()
			turn.CFrame = CFrame.Angles(0, yaw, 0)
		end
	end
	roverSeat:GetPropertyChangedSignal("Occupant"):Connect(function()
		local hum = roverSeat.Occupant
		local player = hum and Players:GetPlayerFromCharacter(hum.Parent)
		if player then
			prompt.Enabled = false
			pcall(function()
				hull:SetNetworkOwner(player)
			end)
			tell(player, "You're driving the Moon Rover! Steer with WASD or the joystick. Jump to get out.", "good")
		else
			prompt.Enabled = true
			lastUsed = os.clock()
			pcall(function()
				hull:SetNetworkOwner(nil)
			end)
			stop()
		end
	end)

	task.spawn(function()
		while true do
			task.wait(0.5)
			local hum = roverSeat.Occupant
			local player = hum and Players:GetPlayerFromCharacter(hum.Parent)
			if player and state[player] and state[player].carrying then -- picked something up while driving
				hum.Sit = false
				tell(player, "No critters in the rover! Out you hop.", "bad")
			end
			local far = (hull.Position - home.Position).Magnitude > 8
			if hull.Position.Y < -30 or (not hum and far and os.clock() - lastUsed > 30) then
				stop()
				rover:PivotTo(home)
				hull.AssemblyLinearVelocity = Vector3.zero
				hull.AssemblyAngularVelocity = Vector3.zero
				local _, yaw = home:ToEulerAnglesYXZ()
				if turn then
					turn.CFrame = CFrame.Angles(0, yaw, 0)
				end
				lastUsed = os.clock()
			end
		end
	end)
end

-- ---------- every second: income; four times a second: home and catch checks ----------
task.spawn(function()
	while true do
		task.wait(1)
		for player, st in pairs(state) do
			local d = PlayerData.get(player)
			local income = incomeOf(st)
			if d and income > 0 then
				d.stardust += income
				refreshStats(player)
			end
		end
	end
end)

task.spawn(function()
	while true do
		task.wait(0.25)
		for player, st in pairs(state) do
			local c = st.carrying
			local hrp = rootOf(player)
			if c and hrp and st.base then
				local p = st.base.cf:PointToObjectSpace(hrp.Position)
				if math.abs(p.X) < st.base.halfW and math.abs(p.Z) < st.base.halfD then
					bringHome(player)
				elseif c.from and c.from.owner and c.from.owner ~= player then
					local ohrp = rootOf(c.from.owner)
					if ohrp and (ohrp.Position - hrp.Position).Magnitude <= Config.CatchDistance then
						local owner = c.from.owner
						dropCarried(player, "caught")
						tell(owner, "You caught " .. player.DisplayName .. "!", "good")
					end
				end
			end
		end
	end
end)

task.spawn(function()
	while true do
		task.wait(Config.AutosaveEvery)
		PlayerData.saveAll()
	end
end)
