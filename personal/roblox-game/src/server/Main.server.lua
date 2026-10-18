-- Captain Nolan's Star Station: the game rules. Grab critters off the launch pad, carry them home, earn Stardust,
-- steal from friends, close your airlock, and catch thieves before they get home.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Config = require(ReplicatedStorage.Shared.Config)
local CritterModels = require(ReplicatedStorage.Shared.CritterModels)
local MapBuilder = require(script.Parent.MapBuilder)
local PlayerData = require(script.Parent.PlayerData)

local map = MapBuilder.build()

local remotes = Instance.new("Folder")
remotes.Name = "Remotes"
remotes.Parent = ReplicatedStorage
local Notify = Instance.new("RemoteEvent")
Notify.Name = "Notify"
Notify.Parent = remotes
local ShieldRequest = Instance.new("RemoteEvent")
ShieldRequest.Name = "ShieldRequest"
ShieldRequest.Parent = remotes

local state = {} -- [player] = { base = base, carrying = { model, def, from = { owner, slot } | nil } }
local conveyor = {} -- critters riding the launch pad

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

local function radiusOf(def)
	return 1.5 * CritterModels.scaleFor(def)
end

local function addCommas(n)
	local s = tostring(math.floor(n))
	local out = s:reverse():gsub("(%d%d%d)", "%1,"):reverse()
	return (out:gsub("^,", ""))
end

-- ---------- leaderboard and income ----------
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
	local income = 0
	if st.base then
		for _, rec in pairs(st.base.slots) do
			income += rec.def.income
		end
	end
	player:SetAttribute("Income", income)
	player:SetAttribute("Stardust", d.stardust)
end

-- ---------- pedestals ----------
local tryStealing -- defined below

local function placeOnPedestal(base, slot, def)
	local ped = base.pedestals[slot]
	local model = CritterModels.build(def, ped.top * CFrame.new(0, radiusOf(def) + 0.3, 0))
	CritterModels.setInfo(model, "+" .. addCommas(def.income) .. " Stardust/s")
	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = "Steal"
	prompt.ObjectText = def.name
	prompt.HoldDuration = Config.StealHold
	prompt.MaxActivationDistance = 9
	prompt.RequiresLineOfSight = false
	prompt:SetAttribute("OwnerUserId", base.owner and base.owner.UserId or 0) -- the owner's own screen hides it
	prompt.Enabled = base.shieldUntil <= now()
	prompt.Parent = model.PrimaryPart
	prompt.Triggered:Connect(function(who)
		tryStealing(who, base, slot)
	end)
	model.Parent = map.critterFolder
	base.slots[slot] = { model = model, def = def, prompt = prompt }
end

local function freeSlot(base)
	for i = 1, Config.PedestalsPerBase do
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

local function attach(player, model, def, from)
	local hrp = rootOf(player)
	if not hrp then
		return false
	end
	for _, d in ipairs(model:GetDescendants()) do
		if d:IsA("ProximityPrompt") then
			d:Destroy()
		end
	end
	local body = model.PrimaryPart
	body.Anchored = false
	body.Massless = true
	model:PivotTo(hrp.CFrame * CFrame.new(0, 3.2 + radiusOf(def), 0))
	local w = Instance.new("WeldConstraint")
	w.Name = "CarryWeld"
	w.Part0 = hrp
	w.Part1 = body
	w.Parent = body
	CritterModels.setInfo(model, from and "STOLEN! Run home!" or "Take it home!")
	state[player].carrying = { model = model, def = def, from = from }
	return true
end

-- a carried critter that never made it home: a stolen one goes back to its owner, a bought one is refunded
local function dropCarried(player, reason)
	local st = state[player]
	local c = st and st.carrying
	if not c then
		return
	end
	st.carrying = nil
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
				placeOnPedestal(ost.base, slot, c.def)
				od.slots[tostring(slot)] = c.def.id
				refreshStats(owner)
				tell(owner, "Your " .. c.def.name .. " came back home!", "good")
			end
		end
		if reason == "caught" then
			tell(player, "Caught! " .. c.def.name .. " went back to its owner.", "bad")
		end
	else
		local d = PlayerData.get(player)
		if d then
			d.stardust += c.def.price
			refreshStats(player)
			if player.Parent then
				tell(player, "You dropped " .. c.def.name .. ". Stardust refunded.", "info")
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
	st.carrying = nil
	c.model:Destroy()
	placeOnPedestal(st.base, slot, c.def)
	d.slots[tostring(slot)] = c.def.id
	d.caught += 1
	refreshStats(player)
	tell(player, c.def.name .. " joined your base! +" .. addCommas(c.def.income) .. " Stardust every second", "good")
	if c.from and c.from.owner then
		tell(c.from.owner, player.DisplayName .. " got away with your " .. c.def.name .. "!", "bad")
	end
end

-- ---------- buying from the launch pad ----------
local function tryBuy(player, item)
	local st = state[player]
	local d = PlayerData.get(player)
	if item.taken or not (st and d) then
		return
	end
	if not st.base then
		tell(player, "The station is full right now: no free base for you yet.", "bad")
		return
	end
	if st.carrying then
		tell(player, "Your hands are full! Take your critter home first.", "bad")
		return
	end
	if d.stardust < item.def.price then
		tell(player, "You need " .. addCommas(item.def.price - d.stardust) .. " more Stardust for " .. item.def.name .. ".", "bad")
		return
	end
	if not freeSlot(st.base) then
		tell(player, "Your base is full! Every pedestal has a critter.", "bad")
		return
	end
	item.taken = true
	d.stardust -= item.def.price
	refreshStats(player)
	if not attach(player, item.model, item.def, nil) then
		d.stardust += item.def.price
		refreshStats(player)
		item.model:Destroy()
		return
	end
	tell(player, "Got " .. item.def.name .. "! Carry it to your base.", "good")
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
	if not attach(thief, rec.model, rec.def, { owner = owner, slot = slot }) then
		placeOnPedestal(base, slot, rec.def)
		od.slots[tostring(slot)] = rec.def.id
		refreshStats(owner)
		return
	end
	tell(thief, "You grabbed " .. rec.def.name .. "! Run to your base before they catch you!", "good")
	tell(owner, "THIEF! " .. thief.DisplayName .. " is stealing your " .. rec.def.name .. ". Catch them!", "bad")
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
local function claimBase(player)
	for _, base in ipairs(map.bases) do
		if not base.owner then
			base.owner = player
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
	-- start each life at your own base
	local st = state[player]
	if st and st.base then
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
	state[player] = { base = claimBase(player), carrying = nil }
	local st = state[player]
	if st.base then
		for k, id in pairs(d.slots) do
			local def = Config.critterById(id)
			if def then
				placeOnPedestal(st.base, tonumber(k), def)
			end
		end
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
	local pool = {}
	local total = 0
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

local FACING = CFrame.Angles(0, math.rad(-90), 0) -- critters face the way the pad moves

local function spawnOnPad()
	local def = pickCritter()
	local y = map.padY + radiusOf(def) + 0.4
	local model = CritterModels.build(def, CFrame.new(map.padStart, y, 0) * FACING)
	CritterModels.setInfo(model, addCommas(def.price) .. " Stardust")
	local item = { model = model, def = def, x = map.padStart, y = y, t = 0, taken = false }
	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = "Grab (" .. addCommas(def.price) .. ")"
	prompt.ObjectText = def.name
	prompt.HoldDuration = 0
	prompt.MaxActivationDistance = 10
	prompt.RequiresLineOfSight = false
	prompt.Parent = model.PrimaryPart
	prompt.Triggered:Connect(function(who)
		tryBuy(who, item)
	end)
	model.Parent = map.critterFolder
	table.insert(conveyor, item)
	if Config.Rarities[def.rarity].order >= 4 then
		tellAll("A " .. def.rarity:upper() .. " critter landed on the launch pad: " .. def.name .. "!", def.rarity == "Cosmic" and "cosmic" or "rare")
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

-- ---------- every second: income; four times a second: home and catch checks ----------
task.spawn(function()
	while true do
		task.wait(1)
		for player, st in pairs(state) do
			local d = PlayerData.get(player)
			if d and st.base then
				local income = 0
				for _, rec in pairs(st.base.slots) do
					income += rec.def.income
				end
				if income > 0 then
					d.stardust += income
					refreshStats(player)
				end
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
