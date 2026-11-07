-- Playing Splash Lagoon on this player's screen (2026-11-07): riding the slides, the lazy river's current, the wave pool's waves,
-- cannonballs and the springboard, the water blaster, Splash Tokens, the rubber duck count, the tipping bucket, and the Captain's
-- park buttons. All of it only runs while you're in the park (your Zone is "park"), and every piece is wrapped so a mistake in one
-- can't stop the others or the station.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local UIS = game:GetService("UserInputService")
local SoundService = game:GetService("SoundService")
local Debris = game:GetService("Debris")

local Config = require(ReplicatedStorage.Shared.Config)
local L = require(ReplicatedStorage.Shared.ParkLayout)
local player = Players.LocalPlayer
local P = Config.Park

local park = workspace:WaitForChild("SplashLagoon", 30)
local remotes = ReplicatedStorage:WaitForChild("Remotes", 30)
local Park = remotes and remotes:WaitForChild("Park", 30)
if not (park and Park) then
	return -- the park didn't build: nothing to do, the station is untouched
end

local TOUCH = UIS.TouchEnabled and not UIS.KeyboardEnabled
local AQUA = Color3.fromRGB(70, 200, 230)
local SUN = Color3.fromRGB(255, 205, 70)
local CORAL = Color3.fromRGB(255, 120, 100)

local function here()
	return player:GetAttribute("Zone") == "park"
end
local function char()
	local ch = player.Character
	local hum = ch and ch:FindFirstChildOfClass("Humanoid")
	local hrp = ch and ch:FindFirstChild("HumanoidRootPart")
	return ch, hum, hrp
end
local function try(name, fn, ...)
	local ok, err = pcall(fn, ...)
	if not ok then
		warn("[Splash Lagoon] " .. name .. ": " .. tostring(err))
	end
	return ok
end

local fx = Instance.new("Folder")
fx.Name = "ParkFX"
fx.Parent = workspace

-- ---------- sounds and effects ----------
local function sfx(name, pos)
	local def = Config.Sounds[name]
	local id = Config.soundId(def) -- nil for a placeholder: skipped
	if not id then
		return
	end
	local s = Instance.new("Sound")
	s.SoundId = id
	s.Volume = def.volume or 0.5
	local holder = s
	if pos then
		local p = Instance.new("Part")
		p.Anchored, p.CanCollide, p.CanQuery, p.CanTouch, p.Transparency = true, false, false, false, 1
		p.Size = Vector3.new(1, 1, 1)
		p.CFrame = CFrame.new(pos)
		p.Parent = fx
		s.RollOffMinDistance, s.RollOffMaxDistance = 14, 160
		s.Parent = p
		holder = p
	else
		s.Parent = SoundService
	end
	s:Play()
	if def.stopAfter then
		task.delay(def.stopAfter, function()
			if s.Parent then
				s:Stop()
			end
		end)
	end
	Debris:AddItem(holder, math.max(def.stopAfter or 0, 6))
end

local function anchorAt(pos)
	local p = Instance.new("Part")
	p.Anchored, p.CanCollide, p.CanQuery, p.CanTouch, p.Transparency = true, false, false, false, 1
	p.Size = Vector3.new(1, 1, 1)
	p.CFrame = CFrame.new(pos)
	p.Parent = fx
	return p
end

-- a splash of water: spray flying up and out, bigger for a bigger size (0.5 to 3)
local function splash(pos, size)
	size = size or 1
	local p = anchorAt(pos)
	local e = Instance.new("ParticleEmitter")
	e.Texture = "rbxasset://textures/particles/smoke_main.dds"
	e.Color = ColorSequence.new(Color3.fromRGB(240, 252, 255), Color3.fromRGB(150, 220, 255))
	e.Size = NumberSequence.new(1.2 * size, 2.4 * size)
	e.Transparency = NumberSequence.new(0.2, 1)
	e.Lifetime = NumberRange.new(0.5, 0.9)
	e.Speed = NumberRange.new(10 * size, 18 * size)
	e.SpreadAngle = Vector2.new(35, 35)
	e.Acceleration = Vector3.new(0, -40, 0)
	e.EmissionDirection = Enum.NormalId.Top
	e.Rate = 0
	e.Parent = p
	e:Emit(math.floor(14 * size))
	local d = Instance.new("ParticleEmitter")
	d.Texture = "rbxasset://textures/particles/sparkles_main.dds"
	d.Color = ColorSequence.new(Color3.fromRGB(200, 240, 255))
	d.Size = NumberSequence.new(0.6, 0.2)
	d.Lifetime = NumberRange.new(0.6, 1)
	d.Speed = NumberRange.new(14 * size, 24 * size)
	d.SpreadAngle = Vector2.new(50, 50)
	d.Acceleration = Vector3.new(0, -50, 0)
	d.EmissionDirection = Enum.NormalId.Top
	d.Rate = 0
	d.Parent = p
	d:Emit(math.floor(18 * size))
	Debris:AddItem(p, 2)
end

local function pop(pos, text, color)
	local p = anchorAt(pos)
	local g = Instance.new("BillboardGui")
	g.Size = UDim2.fromOffset(180, 54)
	g.AlwaysOnTop = true
	g.LightInfluence = 0
	g.MaxDistance = 200
	g.Parent = p
	local l = Instance.new("TextLabel")
	l.Size = UDim2.fromScale(1, 1)
	l.BackgroundTransparency = 1
	l.Font = Enum.Font.FredokaOne
	l.TextScaled = true
	l.TextColor3 = color or SUN
	l.TextStrokeTransparency = 0.2
	l.Text = text
	l.Parent = g
	TweenService:Create(p, TweenInfo.new(1.1, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { CFrame = CFrame.new(pos + Vector3.new(0, 6, 0)) }):Play()
	TweenService:Create(l, TweenInfo.new(1.1), { TextTransparency = 1, TextStrokeTransparency = 1 }):Play()
	Debris:AddItem(p, 1.2)
end

-- ---------- the park's buttons and big words on screen ----------
local gui = Instance.new("ScreenGui")
gui.Name = "SplashLagoonHUD"
gui.ResetOnSpawn = false
gui.IgnoreGuiInset = true
gui.DisplayOrder = 4
gui.Enabled = false
gui.Parent = player:WaitForChild("PlayerGui")

local function corner(o, r)
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, r or 12)
	c.Parent = o
end
local function button(name, text, color, pos, size, anchor)
	local b = Instance.new("TextButton")
	b.Name = name
	b.AnchorPoint = anchor or Vector2.new(1, 1)
	b.Position = pos
	b.Size = size
	b.BackgroundColor3 = color
	b.Font = Enum.Font.FredokaOne
	b.TextScaled = true
	b.TextColor3 = Color3.new(1, 1, 1)
	b.TextStrokeTransparency = 0.6
	b.Text = text
	b.Parent = gui
	corner(b, 16)
	local pad = Instance.new("UIPadding")
	pad.PaddingLeft, pad.PaddingRight, pad.PaddingTop, pad.PaddingBottom = UDim.new(0, 10), UDim.new(0, 10), UDim.new(0, 8), UDim.new(0, 8)
	pad.Parent = b
	return b
end

local flash = Instance.new("Frame")
flash.Size = UDim2.fromScale(1, 1)
flash.BackgroundColor3 = Color3.fromRGB(90, 190, 255)
flash.BackgroundTransparency = 1
flash.BorderSizePixel = 0
flash.Parent = gui
local big = Instance.new("TextLabel")
big.AnchorPoint = Vector2.new(0.5, 0.5)
big.Position = UDim2.fromScale(0.5, 0.3)
big.Size = UDim2.fromScale(0.6, 0.12)
big.BackgroundTransparency = 1
big.Font = Enum.Font.FredokaOne
big.TextScaled = true
big.TextColor3 = Color3.new(1, 1, 1)
big.TextTransparency = 1
big.TextStrokeTransparency = 1
big.Parent = gui
local small = Instance.new("TextLabel")
small.AnchorPoint = Vector2.new(0.5, 0.5)
small.Position = UDim2.fromScale(0.5, 0.39)
small.Size = UDim2.fromScale(0.5, 0.05)
small.BackgroundTransparency = 1
small.Font = Enum.Font.FredokaOne
small.TextScaled = true
small.TextColor3 = Color3.new(1, 1, 1)
small.TextTransparency = 1
small.TextStrokeTransparency = 1
small.Parent = gui
local shoutId = 0
local function shout(text, color, seconds, sub)
	shoutId += 1
	local my = shoutId
	big.Text = text
	big.TextColor3 = color or Color3.new(1, 1, 1)
	big.TextTransparency, big.TextStrokeTransparency = 0, 0
	small.Text = sub or ""
	small.TextTransparency, small.TextStrokeTransparency = sub and 0 or 1, sub and 0.3 or 1
	task.delay(seconds or 2, function()
		if shoutId == my then
			TweenService:Create(big, TweenInfo.new(0.5), { TextTransparency = 1, TextStrokeTransparency = 1 }):Play()
			TweenService:Create(small, TweenInfo.new(0.5), { TextTransparency = 1, TextStrokeTransparency = 1 }):Play()
		end
	end)
end
local function blueFlash(amount)
	flash.BackgroundTransparency = 1 - (amount or 0.45)
	TweenService:Create(flash, TweenInfo.new(0.8), { BackgroundTransparency = 1 }):Play()
end

-- the rubber duck count, top left under the Stardust counter (and under the Book button on a tablet)
local duckPanel = Instance.new("Frame")
duckPanel.Name = "Ducks"
duckPanel.Position = UDim2.new(0, 16, 0, TOUCH and 236 or 156)
duckPanel.Size = UDim2.fromOffset(220, 54)
duckPanel.BackgroundColor3 = Color3.fromRGB(255, 220, 60)
duckPanel.BackgroundTransparency = 0.05
duckPanel.Parent = gui
corner(duckPanel, 14)
local duckL = Instance.new("TextLabel")
duckL.Position = UDim2.fromOffset(12, 6)
duckL.Size = UDim2.new(1, -24, 1, -12)
duckL.BackgroundTransparency = 1
duckL.Font = Enum.Font.FredokaOne
duckL.TextScaled = true
duckL.TextXAlignment = Enum.TextXAlignment.Left
duckL.TextColor3 = Color3.fromRGB(110, 70, 10)
duckL.Text = "Ducks: 0 / " .. #L.Ducks
duckL.Parent = duckPanel

-- the water blaster: where PUNCH is on a tablet (it hides in the park), bottom right on a computer
local splashBtn
if UIS.TouchEnabled then
	splashBtn = button("Splash", "SPLASH", Color3.fromRGB(40, 150, 230), UDim2.new(1, -180, 1, -40), UDim2.fromOffset(100, 100))
	corner(splashBtn, 50)
else
	splashBtn = button("Splash", "Splash! (Q or click)", Color3.fromRGB(40, 150, 230), UDim2.new(1, -16, 1, -24), UDim2.fromOffset(240, 70))
end

-- the Captain's park buttons (only the Captain sees them; in Studio everyone is the Captain)
-- top right, under the Music and Switch game buttons (the station's door buttons are hidden in the park)
local capLabel = Instance.new("TextLabel")
capLabel.AnchorPoint = Vector2.new(1, 0)
capLabel.Position = UDim2.new(1, -16, 0, 172)
capLabel.Size = UDim2.fromOffset(190, 28)
capLabel.BackgroundTransparency = 1
capLabel.Font = Enum.Font.FredokaOne
capLabel.TextScaled = true
capLabel.TextColor3 = Color3.fromRGB(255, 186, 125)
capLabel.TextStrokeTransparency = 0.3
capLabel.Text = "★ Captain's buttons"
capLabel.Parent = gui
local capWave = button("GiantWave", "Giant Wave", Color3.fromRGB(40, 130, 220), UDim2.new(1, -16, 0, 204), UDim2.fromOffset(190, 62), Vector2.new(1, 0))
local capBubbles = button("BubbleParty", "Bubble Party", Color3.fromRGB(150, 110, 240), UDim2.new(1, -16, 0, 274), UDim2.fromOffset(190, 62), Vector2.new(1, 0))
local function refreshCaptain()
	local on = player:GetAttribute("Captain") == true
	capWave.Visible, capBubbles.Visible, capLabel.Visible = on, on, on
end
player:GetAttributeChangedSignal("Captain"):Connect(refreshCaptain)
refreshCaptain()
capWave.Activated:Connect(function()
	Park:FireServer("captain", "wave")
end)
capBubbles.Activated:Connect(function()
	Park:FireServer("captain", "bubbles")
end)

-- ---------- rubber ducks: the count, and found ones vanish from your screen ----------
local foundSet = {}
local duckModels = {} -- [model] = true
local function duckLook(m)
	local id = m:GetAttribute("DuckId")
	local found = id and foundSet[id] or false
	for _, d in ipairs(m:GetDescendants()) do
		if d:IsA("BasePart") then
			d.LocalTransparencyModifier = found and 1 or 0
		elseif d:IsA("ProximityPrompt") then
			d.MaxActivationDistance = found and 0 or 8
		end
	end
end
local function refreshDucks()
	table.clear(foundSet)
	for id in string.gmatch(player:GetAttribute("DucksFound") or "", "[^,]+") do
		foundSet[id] = true
	end
	duckL.Text = "Ducks: " .. (player:GetAttribute("DuckCount") or 0) .. " / " .. (player:GetAttribute("DuckTotal") or #L.Ducks)
	for m in pairs(duckModels) do
		if m.Parent then
			duckLook(m)
		else
			duckModels[m] = nil
		end
	end
end
local function trackDuck(m)
	if m:IsA("Model") and m:GetAttribute("DuckId") then
		duckModels[m] = true
		task.defer(duckLook, m)
	end
end
try("ducks", function()
	local df = park:WaitForChild("Ducks", 20)
	if df then
		for _, m in ipairs(df:GetChildren()) do
			trackDuck(m)
		end
		df.ChildAdded:Connect(trackDuck)
	end
end)
player:GetAttributeChangedSignal("DucksFound"):Connect(refreshDucks)
player:GetAttributeChangedSignal("DuckCount"):Connect(refreshDucks)
refreshDucks()

-- ---------- finding things in the park by name (they may arrive a little after the park folder) ----------
local function whenPart(name, fn)
	local found = park:FindFirstChild(name, true)
	if found then
		task.spawn(try, name, fn, found)
		return
	end
	local conn
	conn = park.DescendantAdded:Connect(function(d)
		if d.Name == name then
			conn:Disconnect()
			task.spawn(try, name, fn, d)
		end
	end)
end

local function prompt(parent, action, object, reach)
	local pp = Instance.new("ProximityPrompt")
	pp.ActionText = action
	pp.ObjectText = object
	pp.HoldDuration = 0
	pp.MaxActivationDistance = reach or 10
	pp.RequiresLineOfSight = false
	pp.Parent = parent
	return pp
end

-- ---------- the slides ----------
-- Press Ride on the pad at the bottom (E, or tap it): you're lifted to the top, sat down, and your own screen carries you along the
-- slide's points at its speed, then drops you into the splash pool with a splash. Nothing is left to physics on the way down, the
-- ride always ends (it has a time limit too), and anything odd (you reset, you leave the park, an error) ends it straight away.
local riding = nil
local UP = Vector3.new(0, 2.4, 0) -- the seat of your pants sits this far above the slide's floor

local function endRide(r, intoPool)
	if riding ~= r then
		return
	end
	riding = nil
	if r.conn then
		r.conn:Disconnect()
	end
	try("ending a ride", function()
		r.hum:SetStateEnabled(Enum.HumanoidStateType.Jumping, true)
		r.hum.Sit = false
		if intoPool and r.hrp.Parent then
			local at = r.slide.splash
			r.hrp.CFrame = CFrame.lookAt(at, at + r.flat)
			r.hrp.AssemblyLinearVelocity = r.flat * 18 + Vector3.new(0, -6, 0)
		end
	end)
	if intoPool then
		local at = r.slide.splash + Vector3.new(0, 2, 0)
		splash(at, 2)
		sfx("splash", at)
		pop(at + Vector3.new(0, 3, 0), "SPLASH!", AQUA)
		Park:FireServer("splash", at, 2)
		if r.slide.countdown then
			shout(string.format("%.1f seconds!", os.clock() - r.started), SUN, 2)
		end
	end
end

local function ride(slide)
	if riding or not here() then
		return
	end
	local ch, hum, hrp = char()
	if not (ch and hum and hrp) or hum.Health <= 0 or hum.SeatPart then
		return
	end
	local pts = slide.points
	if #pts < 2 then
		return
	end
	local cum = { 0 }
	for i = 2, #pts do
		cum[i] = cum[i - 1] + (pts[i] - pts[i - 1]).Magnitude
	end
	local total = cum[#pts]
	local last = pts[#pts] - pts[#pts - 1]
	local flat = Vector3.new(last.X, 0, last.Z)
	flat = flat.Magnitude > 0.01 and flat.Unit or Vector3.new(0, 0, -1)
	local r = { slide = slide, hum = hum, hrp = hrp, ch = ch, flat = flat, started = os.clock(), moving = false, conn = nil }
	riding = r
	pcall(function()
		hum:UnequipTools()
	end)
	hum:SetStateEnabled(Enum.HumanoidStateType.Jumping, false)
	hum.Sit = true
	local startDir = (pts[2] - pts[1]).Unit
	local hold = slide.countdown and 1.8 or 0.5
	local t0 = os.clock()
	local dist, seg, y = 0, 1, pts[1].Y
	local topY = pts[1].Y
	local maxTime = hold + total / slide.base + 3
	local lastPlaced = pts[1] + UP
	local counted = 0
	local function place(pos, dir)
		lastPlaced = pos + UP
		hrp.CFrame = CFrame.lookAt(lastPlaced, lastPlaced + dir)
	end
	place(pts[1], startDir)
	r.conn = RunService.RenderStepped:Connect(function(dt)
		local ok, err = pcall(function()
			if riding ~= r then
				return
			end
			if not (ch.Parent and hrp.Parent and hum.Health > 0) or not here() then
				endRide(r, false)
				return
			end
			if (hrp.Position - lastPlaced).Magnitude > 30 then -- something moved you (a switch of games): stop, leave you there
				endRide(r, false)
				return
			end
			if not hum.Sit then
				hum.Sit = true
			end
			local el = os.clock() - t0
			if el < hold then -- a moment at the top (3, 2, 1 on the racer)
				place(pts[1], startDir)
				hrp.AssemblyLinearVelocity = Vector3.zero
				if slide.countdown then
					local n = 3 - math.floor(el / 0.6)
					if n ~= counted and n >= 1 then
						counted = n
						shout(tostring(n), SUN, 0.5)
					end
				end
				return
			end
			if not r.moving then
				r.moving = true
				r.started = os.clock()
				if slide.countdown then
					shout("GO!", Color3.fromRGB(120, 255, 150), 0.8)
				end
				sfx("slide")
			end
			dt = math.min(dt, 0.1)
			local speed = slide.base + slide.gain * math.sqrt(math.max(0, topY - y))
			dist += speed * dt
			if dist >= total or el > maxTime then
				endRide(r, true)
				return
			end
			while seg < #pts - 1 and cum[seg + 1] < dist do
				seg += 1
			end
			local a, b = pts[seg], pts[seg + 1]
			local f = math.clamp((dist - cum[seg]) / math.max(0.001, cum[seg + 1] - cum[seg]), 0, 1)
			local pos = a:Lerp(b, f)
			local dir = (b - a).Unit
			y = pos.Y
			place(pos, dir)
			hrp.AssemblyLinearVelocity = dir * speed
		end)
		if not ok then
			warn("[Splash Lagoon] ride: " .. tostring(err))
			endRide(r, true)
		end
	end)
end

for _, s in ipairs(L.Slides) do
	whenPart("RidePad_" .. s.id, function(pad)
		local pp = prompt(pad, "Ride!", s.name, 9)
		pp.Triggered:Connect(function()
			ride(s)
		end)
	end)
end

-- ---------- the cannonball tower, the springboard, and cannonballs ----------
whenPart("ClimbPad", function(pad)
	local pp = prompt(pad, "Climb up", "Cannonball Tower", 9)
	pp.Triggered:Connect(function()
		local _, hum, hrp = char()
		if hrp and hum and not riding and here() and not hum.SeatPart then
			hrp.CFrame = L.Cannonball.stand
			hrp.AssemblyLinearVelocity = Vector3.zero
			shout("Walk off the board!", SUN, 2, "Jump in for a CANNONBALL!")
		end
	end)
end)

local lastBounce = 0
whenPart("Springboard", function(board)
	board.Touched:Connect(function(hit)
		local ch, _, hrp = char()
		if not (ch and hrp and hit:IsDescendantOf(ch)) or riding or os.clock() - lastBounce < 0.6 then
			return
		end
		lastBounce = os.clock()
		hrp.AssemblyLinearVelocity = Vector3.new(board:GetAttribute("Push") or 14, board:GetAttribute("Bounce") or 70, 0)
		sfx("bounce", board.Position)
	end)
end)

-- a big jump into the water makes a big splash
local fallFrom = nil
local function hookFalls(ch)
	local hum = ch:WaitForChild("Humanoid", 10)
	if not hum then
		return
	end
	hum.StateChanged:Connect(function(_, new)
		local hrp = ch:FindFirstChild("HumanoidRootPart")
		if not (hrp and here()) or riding then
			fallFrom = nil
			return
		end
		if new == Enum.HumanoidStateType.Freefall then
			fallFrom = hrp.Position.Y
		elseif new == Enum.HumanoidStateType.Swimming then
			local h = fallFrom and (fallFrom - L.Origin.Y) or 0
			fallFrom = nil
			if h >= 9 and L.inAnyWater(hrp.Position) then
				local size = math.clamp(h / 9, 1, 3)
				local at = Vector3.new(hrp.Position.X, L.Origin.Y + 0.5, hrp.Position.Z)
				splash(at, size)
				sfx("splash", at)
				shout(h >= 18 and "MEGA CANNONBALL!" or "CANNONBALL!", AQUA, 1.6)
				Park:FireServer("splash", at, size)
			end
		elseif new == Enum.HumanoidStateType.Landed or new == Enum.HumanoidStateType.Running then
			fallFrom = nil
		end
	end)
end
player.CharacterAdded:Connect(function(ch)
	if riding then -- reset mid-ride: tidy the old ride away
		endRide(riding, false)
	end
	fallFrom = nil
	hookFalls(ch)
end)
if player.Character then
	task.spawn(hookFalls, player.Character)
end

-- ---------- the lazy river's current and the wave pool's waves (only your own character) ----------
local pushedWave = nil
RunService.Heartbeat:Connect(function(dt)
	if not here() or riding then
		return
	end
	local _, hum, hrp = char()
	if not (hum and hrp) or hum.SeatPart then
		return
	end
	dt = math.min(dt, 0.1)
	local pos = hrp.Position
	if L.inRiver(pos) then
		-- carried along: a steady nudge downstream each frame, so you drift round the loop even if you stop swimming
		hrp.CFrame = hrp.CFrame + L.riverFlow(pos) * (L.River.speed * dt)
	elseif L.inWavePool(pos) then
		local t = workspace:GetServerTimeNow()
		local gw = park:GetAttribute("GiantWaveAt") or -1000
		local giant = t - gw < L.WaveTravel
		local crest, id
		if giant then
			crest = L.WavePool.x2 - (L.WavePool.x2 - L.WavePool.x1) * ((t - gw) / L.WaveTravel)
			id = "g" .. tostring(gw)
		else
			crest = L.waveCrestX(t)
			id = "w" .. math.floor(t / L.WaveEvery)
		end
		local lx = pos.X - L.Origin.X
		if crest and math.abs(lx - crest) < 7 then
			-- ride the wave toward the beach while it passes you, with a bob up as it arrives
			hrp.CFrame = hrp.CFrame + Vector3.new(-(giant and 22 or 9) * dt, 0, 0)
			if pushedWave ~= id then
				pushedWave = id
				local v = hrp.AssemblyLinearVelocity
				hrp.AssemblyLinearVelocity = Vector3.new(v.X - (giant and 20 or 8), giant and 26 or 12, v.Z)
			end
		end
	end
end)

-- ---------- what moves on your screen: the wave crest, rings in the river, floats, spinning tokens, the floating duck ----------
local visualOk = try("park visuals", function()
	local crestPart = Instance.new("Part")
	crestPart.Name = "WaveCrest"
	crestPart.Anchored, crestPart.CanCollide, crestPart.CanQuery, crestPart.CanTouch, crestPart.CastShadow = true, false, false, false, false
	crestPart.Material = Enum.Material.SmoothPlastic
	crestPart.Color = Color3.fromRGB(235, 250, 255)
	crestPart.Transparency = 1
	crestPart.Size = Vector3.new(3, 1.2, (L.WavePool.z2 - L.WavePool.z1) - 4)
	crestPart.Parent = fx
	local midZ = (L.WavePool.z1 + L.WavePool.z2) / 2

	local function ring(color, dia)
		local p = Instance.new("Part")
		p.Name = "Float"
		p.Shape = Enum.PartType.Cylinder
		p.Size = Vector3.new(0.9, dia, dia)
		p.Anchored, p.CanCollide, p.CanQuery, p.CanTouch, p.CastShadow = true, false, false, false, false
		p.Color = color
		p.Parent = fx
		return p
	end
	local colors = { CORAL, SUN, AQUA, Color3.fromRGB(150, 110, 240), Color3.fromRGB(110, 220, 140), Color3.fromRGB(255, 150, 200) }
	local loop = L.riverLoop()
	local legs, perim = {}, 0
	for i = 1, #loop do
		local a, b = loop[i], loop[i % #loop + 1]
		table.insert(legs, { a = a, b = b, len = (b - a).Magnitude, start = perim })
		perim += (b - a).Magnitude
	end
	local function onLoop(d)
		d = d % perim
		for _, leg in ipairs(legs) do
			if d <= leg.start + leg.len then
				return leg.a:Lerp(leg.b, (d - leg.start) / leg.len)
			end
		end
		return loop[1]
	end
	local tubes = {}
	for i = 1, 6 do
		table.insert(tubes, { part = ring(colors[i], 5), off = perim * (i - 1) / 6 })
	end
	local floats = {}
	local frng = Random.new(5)
	for i = 1, 5 do
		local x = frng:NextNumber(L.WavePool.x1 + 16, L.WavePool.x2 - 10)
		local z = frng:NextNumber(L.WavePool.z1 + 10, L.WavePool.z2 - 10)
		table.insert(floats, { part = ring(colors[i + 1], 4.5), x = x, z = z, phase = i * 1.3 })
	end
	local spinning = {} -- [token] = its home position
	local floater = nil
	local acc, clock = 0, 0
	local UPRIGHT = CFrame.Angles(0, 0, math.rad(90))
	RunService.RenderStepped:Connect(function(dt)
		if not here() then
			if crestPart.Transparency < 1 then
				crestPart.Transparency = 1
			end
			return
		end
		clock += dt
		acc += dt
		if acc < 1 / 30 then -- 30 times a second is smooth enough and kinder to an iPad
			return
		end
		acc = 0
		local t = workspace:GetServerTimeNow()
		-- the wave
		local gw = park:GetAttribute("GiantWaveAt") or -1000
		local giant = t - gw < L.WaveTravel
		local crest = giant and (L.WavePool.x2 - (L.WavePool.x2 - L.WavePool.x1) * ((t - gw) / L.WaveTravel)) or L.waveCrestX(t)
		if crest then
			local h = giant and 3.5 or 1.2
			crestPart.Size = Vector3.new(giant and 5 or 3, h, crestPart.Size.Z)
			crestPart.CFrame = CFrame.new(L.at(crest, h / 2 - 0.3, midZ))
			crestPart.Transparency = 0.35
		else
			crestPart.Transparency = 1
		end
		-- rings drifting round the lazy river
		for _, tb in ipairs(tubes) do
			local pos = onLoop(tb.off + clock * L.River.speed)
			tb.part.CFrame = CFrame.new(pos + Vector3.new(0, 0.25 + math.sin(clock * 2 + tb.off) * 0.12, 0)) * CFrame.Angles(0, clock * 0.4 + tb.off, 0) * UPRIGHT
		end
		-- floats bobbing on the wave pool, lifted as a wave goes under
		for _, fl in ipairs(floats) do
			local lift = (crest and math.abs(fl.x - crest) < 8) and (giant and 2.5 or 0.9) or 0
			fl.part.CFrame = CFrame.new(L.at(fl.x, 0.25 + math.sin(clock * 1.5 + fl.phase) * 0.2 + lift, fl.z)) * UPRIGHT
		end
		-- tokens spin, bubbles bob
		local tokens = park:FindFirstChild("Tokens")
		if tokens then
			for _, p in ipairs(tokens:GetChildren()) do
				if p:IsA("BasePart") then
					local home = spinning[p]
					if not home then
						home = p.Position
						spinning[p] = home
					end
					if p.Name == "Bubble" then
						p.CFrame = CFrame.new(home + Vector3.new(0, math.sin(clock * 2 + home.X) * 0.6, 0))
					else
						p.CFrame = CFrame.new(home + Vector3.new(0, math.sin(clock * 3 + home.Z) * 0.3, 0)) * CFrame.Angles(0, clock * 2.5 + home.X, 0)
					end
				end
			end
			for p in pairs(spinning) do
				if not p.Parent then
					spinning[p] = nil
				end
			end
		end
		-- the duck floating in the river bobs
		if not floater then
			local df = park:FindFirstChild("Ducks")
			for _, m in ipairs(df and df:GetChildren() or {}) do
				if m:IsA("Model") and m:GetAttribute("Floats") then
					floater = { model = m, home = m:GetPivot() }
				end
			end
		end
		if floater and floater.model.Parent then
			floater.model:PivotTo(floater.home * CFrame.new(0, math.sin(clock * 1.8) * 0.15, 0) * CFrame.Angles(0, 0, math.sin(clock * 1.3) * 0.08))
		end
	end)
end)
if not visualOk then
	warn("[Splash Lagoon] park visuals are off")
end

-- ---------- Splash Tokens: your screen grabs one the moment you touch it, and the server checks and pays ----------
local claimed = {} -- [token] = os.clock() when we grabbed it
task.spawn(function()
	while true do
		task.wait(0.1)
		if here() then
			try("tokens", function()
				local _, _, hrp = char()
				local tokens = park:FindFirstChild("Tokens")
				if not (hrp and tokens) then
					return
				end
				local now0 = os.clock()
				for _, p in ipairs(tokens:GetChildren()) do
					local c = claimed[p]
					if c then
						if now0 - c > 2 and p.Parent then -- someone else got it first: show it again
							claimed[p] = nil
							p.LocalTransparencyModifier = 0
						end
					elseif p:IsA("BasePart") and p:GetAttribute("Ready") and (p.Position - hrp.Position).Magnitude <= P.tokenPickup then
						claimed[p] = now0
						p.LocalTransparencyModifier = 1
						splash(p.Position, 0.5)
						sfx("token", p.Position)
						Park:FireServer("token", p)
					end
				end
				for p in pairs(claimed) do
					if not p.Parent then
						claimed[p] = nil
					end
				end
			end)
		end
	end
end)

-- ---------- the big bucket: a countdown on its sign, and every so often it tips ----------
local bucketTip
try("bucket", function()
	local tower = park:WaitForChild("SplashPad", 20)
	tower = tower and tower:WaitForChild("BucketTower", 10)
	local bucket = tower and tower:WaitForChild("Bucket", 10)
	if not (bucket and bucket.PrimaryPart) then
		return
	end
	local home = bucket:GetPivot()
	local angle = Instance.new("NumberValue")
	angle.Changed:Connect(function(a)
		bucket:PivotTo(home * CFrame.Angles(math.rad(a), 0, 0))
	end)
	local labels = {}
	for _, d in ipairs(tower:GetDescendants()) do
		if d:IsA("TextLabel") and d.Name == "BucketTimer" then
			table.insert(labels, d)
		end
	end
	local B = L.Bucket
	local ground = L.at(B.x, 0.5, B.z)
	local warned = false
	task.spawn(function()
		while true do
			task.wait(0.25)
			if here() then
				local left = math.ceil((park:GetAttribute("BucketNext") or 0) - workspace:GetServerTimeNow())
				local text = left > 0 and ("Bucket tips in " .. left .. "s") or "SPLASH!"
				for _, l in ipairs(labels) do
					l.Text = text
				end
				local _, _, hrp = char()
				local near = hrp and (Vector3.new(hrp.Position.X, 0, hrp.Position.Z) - Vector3.new(ground.X, 0, ground.Z)).Magnitude < 40
				if left == 3 and near and not warned then
					warned = true
					shout("The bucket is tipping!", SUN, 1.5, "Stand under it to get SOAKED!")
				elseif left > 3 then
					warned = false
				end
			end
		end
	end)
	bucketTip = function()
		TweenService:Create(angle, TweenInfo.new(0.9, Enum.EasingStyle.Quad, Enum.EasingDirection.In), { Value = 115 }):Play()
		task.delay(0.7, function()
			-- the water comes down: a big splash on the pad and spray off the bucket's lip
			splash(ground, 3)
			splash(ground + Vector3.new(0, B.height * 0.6, 0), 2)
			sfx("splash", ground)
			sfx("bucket", ground)
			local _, _, hrp = char()
			if hrp then
				local flatD = (Vector3.new(hrp.Position.X, 0, hrp.Position.Z) - Vector3.new(ground.X, 0, ground.Z)).Magnitude
				if flatD <= B.soakRadius and hrp.Position.Y - L.Origin.Y < 20 then
					blueFlash(0.5)
					shout("SOAKED!", AQUA, 1.6, "The big bucket got you!")
				end
			end
		end)
		task.delay(2.3, function()
			TweenService:Create(angle, TweenInfo.new(1.6, Enum.EasingStyle.Sine, Enum.EasingDirection.Out), { Value = 0 }):Play()
		end)
	end
end)

-- ---------- the water blaster: a spray of water, a splash, and SOAKED! on whoever it hits ----------
local lastSpray = 0
local function sprayFrom(fromPos, toPos)
	local drops = {}
	for k = 1, 6 do
		local d = Instance.new("Part")
		d.Name = "Droplet"
		d.Shape = Enum.PartType.Ball
		d.Size = Vector3.new(0.7, 0.7, 0.7)
		d.Color = Color3.fromRGB(110, 200, 255)
		d.Material = Enum.Material.SmoothPlastic
		d.Transparency = 0.2
		d.Anchored, d.CanCollide, d.CanQuery, d.CanTouch, d.CastShadow = true, false, false, false, false
		d.CFrame = CFrame.new(fromPos)
		d.Parent = fx
		drops[k] = d
	end
	local t0 = os.clock()
	local flight = 0.4
	local conn
	conn = RunService.RenderStepped:Connect(function()
		local el = os.clock() - t0
		local done = true
		for k, d in ipairs(drops) do
			local a = math.clamp((el - (k - 1) * 0.04) / flight, 0, 1)
			if a < 1 then
				done = false
			end
			d.CFrame = CFrame.new(fromPos:Lerp(toPos, a) + Vector3.new(0, 4 * a * (1 - a) * 2.5, 0))
		end
		if done then
			conn:Disconnect()
			for _, d in ipairs(drops) do
				d:Destroy()
			end
			splash(toPos, 0.7)
		end
	end)
end
local function spray()
	if not here() or riding or os.clock() - lastSpray < P.soakCooldown then
		return
	end
	local _, _, hrp = char()
	if not hrp then
		return
	end
	lastSpray = os.clock()
	local look = hrp.CFrame.LookVector
	local from = hrp.Position + look * 2 + Vector3.new(0, 1, 0)
	local to = hrp.Position + look * (P.soakRange * 0.8) + Vector3.new(0, -2, 0)
	sprayFrom(from, to)
	Park:FireServer("soak")
end
splashBtn.Activated:Connect(spray)
UIS.InputBegan:Connect(function(input, typing)
	if typing or not here() then
		return
	end
	if input.KeyCode == Enum.KeyCode.Q or input.KeyCode == Enum.KeyCode.ButtonX or input.UserInputType == Enum.UserInputType.MouseButton1 then
		spray()
	end
end)

-- ---------- news from the server ----------
Park.OnClientEvent:Connect(function(kind, a, b, c)
	if kind == "stopride" then
		if riding then
			endRide(riding, false)
		end
		return
	end
	if not here() then
		return
	end
	try("park event " .. tostring(kind), function()
		if kind == "pop" then
			pop(a, b, SUN)
		elseif kind == "poof" then
			splash(a, b and 0.8 or 0.5)
		elseif kind == "splash" then
			splash(a, b)
			sfx("splash", a)
		elseif kind == "spray" then
			local hrp = a and a.Character and a.Character:FindFirstChild("HumanoidRootPart")
			if hrp and typeof(b) == "Vector3" then
				sprayFrom(hrp.Position + hrp.CFrame.LookVector * 2 + Vector3.new(0, 1, 0), b)
			end
		elseif kind == "soaked" then
			blueFlash(0.45)
			shout("SOAKED!", AQUA, 1.4, tostring(a) .. " got you!")
			local _, _, hrp = char()
			if hrp then -- drips for a couple of seconds
				local e = Instance.new("ParticleEmitter")
				e.Texture = "rbxasset://textures/particles/sparkles_main.dds"
				e.Color = ColorSequence.new(Color3.fromRGB(150, 220, 255))
				e.Size = NumberSequence.new(0.4, 0.2)
				e.Lifetime = NumberRange.new(0.4, 0.7)
				e.Rate = 18
				e.Speed = NumberRange.new(1, 3)
				e.Acceleration = Vector3.new(0, -30, 0)
				e.SpreadAngle = Vector2.new(60, 60)
				e.Parent = hrp
				Debris:AddItem(e, 2)
			end
		elseif kind == "soakhit" then
			local head = a and a.Character and a.Character:FindFirstChild("Head")
			if head then
				pop(head.Position + Vector3.new(0, 2, 0), "SOAKED!", AQUA)
			end
		elseif kind == "bucket" then
			if bucketTip then
				bucketTip()
			end
		elseif kind == "duck" then
			splash(a, 0.8)
			pop(a + Vector3.new(0, 2, 0), "QUACK!", SUN)
			shout("Rubber duck " .. tostring(b) .. " of " .. tostring(c) .. "!", SUN, 2)
		elseif kind == "giantwave" then
			shout("GIANT WAVE!", AQUA, 2.5, "Captain's orders!")
			sfx("wave")
		elseif kind == "bubbles" then
			shout("BUBBLE PARTY!", Color3.fromRGB(190, 230, 255), 2.5, "Pop the bubbles for Stardust!")
			local _, _, hrp = char()
			if hrp then
				local e = Instance.new("ParticleEmitter")
				e.Texture = "rbxasset://textures/particles/sparkles_main.dds"
				e.Color = ColorSequence.new(Color3.fromRGB(190, 235, 255), Color3.fromRGB(255, 200, 240))
				e.Size = NumberSequence.new(0.8, 1.4)
				e.Transparency = NumberSequence.new(0.3, 1)
				e.Lifetime = NumberRange.new(2, 3)
				e.Rate = 6
				e.Speed = NumberRange.new(1, 3)
				e.Acceleration = Vector3.new(0, 2, 0)
				e.SpreadAngle = Vector2.new(180, 180)
				e.Parent = hrp
				Debris:AddItem(e, tonumber(a) or 20)
			end
		end
	end)
end)

-- ---------- coming and going ----------
local function onZone()
	local inside = here()
	gui.Enabled = inside
	if inside then
		local _, hum = char()
		if hum then
			pcall(function()
				hum:UnequipTools() -- the station's weapons stay in the backpack here
			end)
		end
		refreshDucks()
		shout(L.Name, AQUA, 2.5, "Ride the slides and find the rubber ducks!")
	elseif riding then
		endRide(riding, false)
	end
end
player:GetAttributeChangedSignal("Zone"):Connect(onZone)
onZone()
