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
	prompt.RequiresLineOfSight = false
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
	if c.from and c.from.owner then
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
		tell(thief, "The airlock is closed! Wait for it to open.", "bad")
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
local function setShieldVisual(base, on)
	base.shield.Transparency = on and 0.35 or 1
	for _, rec in pairs(base.slots) do
		rec.prompt.Enabled = not on
	end
end

local function closeAirlock(player)
	local st = state[player]
	local base = st and st.base
	if not base then
		return
	end
	local t = now()
	if base.shieldUntil > t then
		tell(player, "Your airlock is already closed.", "info")
		return
	end
	if base.cooldownUntil > t then
		tell(player, "The airlock is recharging: " .. math.ceil(base.cooldownUntil - t) .. "s", "info")
		return
	end
	base.shieldUntil = t + Config.ShieldSeconds
	base.cooldownUntil = base.shieldUntil + Config.ShieldCooldown
	base.root:SetAttribute("ShieldUntil", base.shieldUntil)
	base.root:SetAttribute("CooldownUntil", base.cooldownUntil)
	setShieldVisual(base, true)
	tell(player, "Airlock closed! Nobody can steal for " .. Config.ShieldSeconds .. " seconds.", "good")
	local myUntil = base.shieldUntil
	task.delay(Config.ShieldSeconds, function()
		if base.shieldUntil == myUntil then
			setShieldVisual(base, false)
			if base.owner == player then
				tell(player, "Your airlock is open again. Guard your critters!", "info")
			end
		end
	end)
end

ShieldRequest.OnServerEvent:Connect(closeAirlock)
for _, base in ipairs(map.bases) do
	base.consolePrompt.Triggered:Connect(function(who)
		if base.owner == who then
			closeAirlock(who)
		else
			tell(who, "That's not your airlock.", "info")
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
				elseif c.from and c.from.owner then
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
