-- The "juice", drawn on this player's screen only: sounds, punch and weapon animations, sparkles and confetti, pop-up numbers, the steal alarm, a guide beam
-- home while carrying, "+income" over your base, bobbing critters, spinning stars, and rainbow critters cycling colour.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local Debris = game:GetService("Debris")

local Config = require(ReplicatedStorage.Shared.Config)
local FX = ReplicatedStorage:WaitForChild("Remotes"):WaitForChild("FX")
local player = Players.LocalPlayer
local C = Config.Colors

local station = workspace:WaitForChild("Station", 30)
if not station then
	return
end
local critters = station:WaitForChild("Critters", 30)
local starsFolder = station:WaitForChild("Stars", 30)

local fxFolder = Instance.new("Folder")
fxFolder.Name = "LocalFX"
fxFolder.Parent = workspace

local function anchorAt(pos)
	local p = Instance.new("Part")
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.Transparency = 1
	p.Size = Vector3.new(1, 1, 1)
	p.CFrame = CFrame.new(pos)
	p.Parent = fxFolder
	return p
end

local function burst(pos, color, count, colors)
	local p = anchorAt(pos)
	local e = Instance.new("ParticleEmitter")
	e.Texture = "rbxasset://textures/particles/sparkles_main.dds"
	e.Color = colors or ColorSequence.new(color or C.Orange)
	e.LightEmission = 1
	e.Size = NumberSequence.new(0.6, 0)
	e.Lifetime = NumberRange.new(0.5, 1)
	e.Speed = NumberRange.new(8, 16)
	e.SpreadAngle = Vector2.new(180, 180)
	e.Rate = 0
	e.Parent = p
	e:Emit(count or 30)
	Debris:AddItem(p, 2)
end

local function pop(pos, text, color)
	local p = anchorAt(pos)
	local g = Instance.new("BillboardGui")
	g.Size = UDim2.fromOffset(160, 50)
	g.AlwaysOnTop = true
	g.LightInfluence = 0
	g.Parent = p
	local l = Instance.new("TextLabel")
	l.Size = UDim2.fromScale(1, 1)
	l.BackgroundTransparency = 1
	l.Font = Enum.Font.FredokaOne
	l.TextScaled = true
	l.TextColor3 = color or C.Orange
	l.TextStrokeTransparency = 0.2
	l.Text = text
	l.Parent = g
	TweenService:Create(p, TweenInfo.new(1.1, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { CFrame = CFrame.new(pos + Vector3.new(0, 6, 0)) }):Play()
	TweenService:Create(l, TweenInfo.new(1.1), { TextTransparency = 1, TextStrokeTransparency = 1 }):Play()
	Debris:AddItem(p, 1.2)
end

-- ---------- screen overlays: the steal alarm and the meteor shower ----------
local gui = Instance.new("ScreenGui")
gui.Name = "FXOverlay"
gui.ResetOnSpawn = false
gui.IgnoreGuiInset = true
gui.DisplayOrder = 5
gui.Parent = player:WaitForChild("PlayerGui")
local flash = Instance.new("Frame")
flash.Size = UDim2.fromScale(1, 1)
flash.BackgroundColor3 = Color3.fromRGB(255, 40, 60)
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
big.TextStrokeTransparency = 0
big.TextTransparency = 1
big.TextStrokeTransparency = 1
big.Parent = gui

local function shout(text, color, seconds)
	big.Text = text
	big.TextColor3 = color
	big.TextTransparency = 0
	big.TextStrokeTransparency = 0
	task.delay(seconds or 2, function()
		TweenService:Create(big, TweenInfo.new(0.5), { TextTransparency = 1, TextStrokeTransparency = 1 }):Play()
	end)
end

local function alarm(baseIndex)
	shout("THIEF!", Color3.fromRGB(255, 90, 100), 2.5)
	for i = 1, 4 do
		task.delay((i - 1) * 0.5, function()
			flash.BackgroundTransparency = 0.6
			TweenService:Create(flash, TweenInfo.new(0.4), { BackgroundTransparency = 1 }):Play()
		end)
	end
	for _, m in ipairs(station:GetChildren()) do
		if m:IsA("Model") and m:GetAttribute("BaseIndex") == baseIndex then
			local shield = m:FindFirstChild("Shield")
			if shield then
				local red = shield:Clone()
				red.Name = "AlarmGlow"
				red.Color = Color3.fromRGB(255, 50, 70)
				red.Material = Enum.Material.Neon
				red.Transparency = 0.6
				red.Parent = fxFolder
				TweenService:Create(red, TweenInfo.new(0.5, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, 4, true), { Transparency = 1 }):Play()
				Debris:AddItem(red, 4.5)
			end
		end
	end
end

-- ---------- sounds (2026-10-18): ids and volumes live in Config.Sounds ----------
local SoundService = game:GetService("SoundService")
local function sfx(name, pos)
	local def = Config.Sounds[name]
	if not def then
		return
	end
	local s = Instance.new("Sound")
	s.SoundId = "rbxassetid://" .. def.id
	s.Volume = def.volume or 0.5
	s.PlaybackSpeed = def.pitch or 1
	local holder = s
	if pos then -- in the world: louder close by
		local p = anchorAt(pos)
		s.RollOffMinDistance = 14
		s.RollOffMaxDistance = 160
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
	Debris:AddItem(holder, math.max(def.stopAfter or 0, 8))
end

-- ---------- arm animations (2026-10-18, Matthew: "a punching animation", "animations to the weapons") ----------
-- Every screen moves the puncher's shoulder joint itself, so everyone sees the swing without any uploaded animations.
local restC0 = {} -- [Motor6D] = its normal C0
local armTweens = {} -- [Motor6D] = the tween playing on it
local function joint(char, r15Part, r15Name, r6Name)
	local p = char:FindFirstChild(r15Part)
	local m = p and p:FindFirstChild(r15Name)
	if m and m:IsA("Motor6D") then
		return m, true
	end
	local torso = char:FindFirstChild("Torso")
	m = torso and torso:FindFirstChild(r6Name)
	if m and m:IsA("Motor6D") then
		return m, false
	end
	return nil
end

-- steps: a list of { angle forward (radians), twist of the body, seconds }; ends back at rest
local function animate(char, steps)
	local shoulder, r15 = joint(char, "RightUpperArm", "RightShoulder", "Right Shoulder")
	local waist = r15 and select(1, joint(char, "UpperTorso", "Waist", "")) or nil
	if not shoulder then
		return
	end
	restC0[shoulder] = restC0[shoulder] or shoulder.C0
	if waist then
		restC0[waist] = restC0[waist] or waist.C0
	end
	local token = {}
	armTweens[shoulder] = token
	task.spawn(function()
		for _, st in ipairs(steps) do
			if armTweens[shoulder] ~= token or not shoulder.Parent then
				return
			end
			local angle, twist, secs = st[1], st[2], st[3]
			local goal = r15 and (restC0[shoulder] * CFrame.Angles(angle, 0, 0)) or (restC0[shoulder] * CFrame.Angles(0, 0, angle))
			TweenService:Create(shoulder, TweenInfo.new(secs, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { C0 = goal }):Play()
			if waist then
				TweenService:Create(waist, TweenInfo.new(secs, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { C0 = restC0[waist] * CFrame.Angles(0, twist, 0) }):Play()
			end
			task.wait(secs)
		end
		if armTweens[shoulder] == token and shoulder.Parent then
			TweenService:Create(shoulder, TweenInfo.new(0.22, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { C0 = restC0[shoulder] }):Play()
			if waist then
				TweenService:Create(waist, TweenInfo.new(0.22, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { C0 = restC0[waist] }):Play()
			end
		end
	end)
end

local function heldTool(char, id)
	local t = char and char:FindFirstChildOfClass("Tool")
	return t and t:GetAttribute("GearId") == id and t or nil
end

-- the glove shoots out on its spring and snaps back
local function springGlove(tool)
	local handle = tool:FindFirstChild("Handle")
	local gj = handle and handle:FindFirstChild("GloveJoint")
	local sj = handle and handle:FindFirstChild("SpringJoint")
	local rod = sj and sj.Part1
	if not (gj and sj and rod) then
		return
	end
	restC0[gj] = restC0[gj] or gj.C0
	restC0[sj] = restC0[sj] or sj.C0
	restC0[rod] = restC0[rod] or rod.Size
	local reach = 4.2
	local out = TweenInfo.new(0.09, Enum.EasingStyle.Back, Enum.EasingDirection.Out)
	local back = TweenInfo.new(0.28, Enum.EasingStyle.Elastic, Enum.EasingDirection.Out)
	task.delay(0.1, function()
		TweenService:Create(gj, out, { C0 = CFrame.new(0, 0, -reach) * restC0[gj] }):Play()
		TweenService:Create(sj, out, { C0 = CFrame.new(0, 0, -reach / 2) * restC0[sj] }):Play()
		TweenService:Create(rod, out, { Size = restC0[rod] + Vector3.new(reach, 0, 0) }):Play()
		task.wait(0.16)
		TweenService:Create(gj, back, { C0 = restC0[gj] }):Play()
		TweenService:Create(sj, back, { C0 = restC0[sj] }):Play()
		TweenService:Create(rod, back, { Size = restC0[rod] }):Play()
	end)
end

local function swing(pos, who, style)
	local char = who and who.Character
	if style == "glove" then
		sfx("glove", pos)
		if char then
			animate(char, { { -0.6, -0.35, 0.1 }, { 0.35, 0.4, 0.09 }, { 0.35, 0.4, 0.14 } }) -- wind up, thrust, hold
			local tool = heldTool(char, "glove")
			if tool then
				springGlove(tool)
			end
		end
		burst(pos + (char and char:FindFirstChild("HumanoidRootPart") and char.HumanoidRootPart.CFrame.LookVector * 4 or Vector3.zero), Color3.fromRGB(255, 255, 255), 12)
	else
		sfx("swing", pos)
		if char then
			animate(char, { { -0.45, -0.3, 0.07 }, { 1.65, 0.35, 0.08 }, { 1.65, 0.35, 0.06 } }) -- pull back, jab, hold
		end
		burst(pos, Color3.fromRGB(255, 255, 255), 8)
	end
end

-- the Star Blaster: kick, a flash at the muzzle, a glowing bolt flying to where it lands
local function blast(who, from, to, landed)
	local char = who and who.Character
	sfx("blaster", from)
	if char then
		animate(char, { { 0.4, 0, 0.05 }, { 0.4, 0, 0.08 } }) -- recoil
		local tool = heldTool(char, "blaster")
		local crystal = tool and tool:FindFirstChild("Crystal")
		local flashLight = crystal and crystal:FindFirstChild("Flash")
		if flashLight then
			flashLight.Brightness = 6
			TweenService:Create(flashLight, TweenInfo.new(0.25), { Brightness = 0 }):Play()
		end
	end
	burst(from, C.Orange, 10)
	local dist = (to - from).Magnitude
	local bolt = Instance.new("Part")
	bolt.Name = "StarBolt"
	bolt.Shape = Enum.PartType.Ball
	bolt.Size = Vector3.new(1.1, 1.1, 1.1)
	bolt.Color = C.Orange
	bolt.Material = Enum.Material.Neon
	bolt.Anchored = true
	bolt.CanCollide = false
	bolt.CanQuery = false
	bolt.CanTouch = false
	bolt.CFrame = CFrame.new(from)
	bolt.Parent = fxFolder
	local glowLight = Instance.new("PointLight")
	glowLight.Color = C.Orange
	glowLight.Range = 10
	glowLight.Brightness = 3
	glowLight.Parent = bolt
	local trail = Instance.new("Part") -- a streak behind it that stretches as it flies
	trail.Anchored = true
	trail.CanCollide = false
	trail.CanQuery = false
	trail.CanTouch = false
	trail.Material = Enum.Material.Neon
	trail.Color = C.Blue
	trail.Transparency = 0.3
	trail.Size = Vector3.new(0.35, 0.35, 0.1)
	trail.Parent = fxFolder
	local secs = math.max(0.08, dist / 220)
	local t0 = os.clock()
	local conn
	conn = RunService.RenderStepped:Connect(function()
		local a = math.clamp((os.clock() - t0) / secs, 0, 1)
		local at = from:Lerp(to, a)
		bolt.CFrame = CFrame.new(at)
		local tail = from:Lerp(to, math.max(0, a - 0.35))
		local len = (at - tail).Magnitude
		if len > 0.05 then
			trail.Size = Vector3.new(0.35, 0.35, len)
			trail.CFrame = CFrame.lookAt((at + tail) / 2, at)
		end
		if a >= 1 then
			conn:Disconnect()
			bolt:Destroy()
			trail:Destroy()
			burst(to, landed and C.Orange or C.Blue, landed and 30 or 14)
			sfx("bolt", to)
		end
	end)
end

FX.OnClientEvent:Connect(function(kind, a, b, c, d)
	if kind == "burst" then
		burst(a, b)
	elseif kind == "confetti" then
		sfx("home", a)
		burst(a, nil, 60, ColorSequence.new({ ColorSequenceKeypoint.new(0, C.Orange), ColorSequenceKeypoint.new(0.5, C.Blue), ColorSequenceKeypoint.new(1, C.Orange) }))
	elseif kind == "pop" then
		pop(a, b)
		sfx("star", a)
	elseif kind == "alarm" then
		alarm(a)
		sfx("alarm")
	elseif kind == "shower" then
		shout("METEOR SHOWER!", C.Blue, 3)
		sfx("shower")
	elseif kind == "swing" then
		swing(a, b, c)
	elseif kind == "blast" then
		blast(a, b, c, d)
	elseif kind == "sfx" then
		sfx(a, b)
	elseif kind == "pow" then
		burst(a, C.Orange, 40)
		pop(a + Vector3.new(0, 3, 0), "POW!", C.Orange)
		sfx("pow", a)
	elseif kind == "knock" then -- you were punched: fly back a bit
		local hrp = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
		if hrp then
			hrp.AssemblyLinearVelocity = a * Config.Punch.knock + Vector3.new(0, 28, 0)
		end
		flash.BackgroundColor3 = Color3.fromRGB(255, 160, 60)
		flash.BackgroundTransparency = 0.6
		local tw = TweenService:Create(flash, TweenInfo.new(0.4), { BackgroundTransparency = 1 })
		tw:Play()
		tw.Completed:Connect(function() flash.BackgroundColor3 = Color3.fromRGB(255, 40, 60) end)
	elseif kind == "zapped" then
		shout("ZAPPED!", Color3.fromRGB(255, 120, 120), 1.5)
		sfx("zapped")
	elseif kind == "night" then
		shout("BLACK HOLE NIGHT!", Color3.fromRGB(200, 140, 255), 3)
	elseif kind == "booped" then
		shout("BOOP!", Color3.fromRGB(200, 140, 255), 1.5)
		sfx("booped")
		flash.BackgroundColor3 = Color3.fromRGB(120, 50, 200)
		flash.BackgroundTransparency = 0.4
		local tw = TweenService:Create(flash, TweenInfo.new(0.8), { BackgroundTransparency = 1 })
		tw:Play()
		tw.Completed:Connect(function()
			flash.BackgroundColor3 = Color3.fromRGB(255, 40, 60)
		end)
	end
end)

-- ---------- your base: where it is, a guide beam home, "+income" above it ----------
local function myBase()
	for _, m in ipairs(station:GetChildren()) do
		if m:IsA("Model") and m:GetAttribute("OwnerUserId") == player.UserId then
			return m
		end
	end
	return nil
end

local beam, a0, a1 = nil, nil, nil
local function updateBeam()
	local carrying = player:GetAttribute("Carrying")
	local base = myBase()
	local hrp = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
	if carrying and base and base.PrimaryPart and hrp then
		if not beam then
			a0 = Instance.new("Attachment")
			a0.Name = "GuideFrom"
			a1 = Instance.new("Attachment")
			a1.Name = "GuideTo"
			beam = Instance.new("Beam")
			beam.Color = ColorSequence.new(C.Orange, C.Blue)
			beam.LightEmission = 1
			beam.Width0, beam.Width1 = 0.8, 2.4
			beam.FaceCamera = true
			beam.Transparency = NumberSequence.new(0.2, 0.5)
			beam.TextureSpeed = 2
			beam.Texture = "rbxasset://textures/particles/sparkles_main.dds"
			beam.Parent = fxFolder
		end
		a0.Parent = hrp
		a1.Parent = base.PrimaryPart
		a1.Position = Vector3.new(0, 2, 0)
		beam.Attachment0, beam.Attachment1 = a0, a1
		beam.Enabled = true
	elseif beam then
		beam.Enabled = false
	end
end
player:GetAttributeChangedSignal("Carrying"):Connect(updateBeam)
player.CharacterAdded:Connect(function()
	task.wait(0.5)
	updateBeam()
end)

task.spawn(function()
	while true do
		task.wait(1)
		local income = player:GetAttribute("Income") or 0
		local base = myBase()
		if income > 0 and base and base.PrimaryPart then
			local s = tostring(income):reverse():gsub("(%d%d%d)", "%1,"):reverse():gsub("^,", "")
			pop(base.PrimaryPart.Position + Vector3.new(0, 9, 8), "+" .. s .. " ★", C.Orange)
		end
	end
end)

-- ---------- moving things: bobbing critters, spinning stars, rainbow colours ----------
local bobbers = {} -- [model] = { origin = CFrame, phase = number }
local starOrigins = {} -- [part] = CFrame
local rainbows = {} -- [model] = true

local function track(m)
	if not m:IsA("Model") then
		return
	end
	if m:GetAttribute("Rainbow") then
		rainbows[m] = true
	end
end
for _, m in ipairs(critters:GetChildren()) do
	track(m)
end
critters.ChildAdded:Connect(track)

local keep = { Eye = true, Pupil = true, Nose = true, Smile = true }
local t = 0
RunService.RenderStepped:Connect(function(dt)
	t += dt
	-- critters on pedestals bob gently (left alone the moment the server moves them)
	for _, m in ipairs(critters:GetChildren()) do
		local body = m:IsA("Model") and m.PrimaryPart
		if body and body.Anchored and m:GetAttribute("OnPedestal") then
			local rec = bobbers[m]
			if not rec then
				rec = { origin = m:GetPivot(), phase = math.random() * 6 }
				bobbers[m] = rec
			end
			m:PivotTo(rec.origin * CFrame.new(0, math.sin(t * 2 + rec.phase) * 0.35, 0) * CFrame.Angles(0, math.sin(t * 0.8 + rec.phase) * 0.25, 0))
		elseif bobbers[m] then
			bobbers[m] = nil
		end
	end
	for m in pairs(bobbers) do
		if not m.Parent then
			bobbers[m] = nil
		end
	end
	-- stars spin and bob once they've landed
	if starsFolder then
		for _, s in ipairs(starsFolder:GetChildren()) do
			if s:IsA("BasePart") and s:GetAttribute("Ready") then
				local o = starOrigins[s]
				if not o then
					o = s.CFrame
					starOrigins[s] = o
				end
				s.CFrame = o * CFrame.new(0, math.sin(t * 3 + o.Position.X) * 0.4, 0)
			end
		end
		for s in pairs(starOrigins) do
			if not s.Parent then
				starOrigins[s] = nil
			end
		end
	end
	-- rainbow critters cycle through the colours
	for m in pairs(rainbows) do
		if m.Parent then
			local h = (t * 0.25) % 1
			local body = m.PrimaryPart
			local by, bh = body and body.Position.Y or 0, body and body.Size.Y or 1
			for _, p in ipairs(m:GetDescendants()) do
				if p:IsA("BasePart") and not keep[p.Name] then
					-- the hue shifts with height, so a Rainbow critter wears a whole rainbow at once, top to bottom (2026-10-18)
					p.Color = Color3.fromHSV((h + (p.Position.Y - by) / bh * 0.35) % 1, 0.55, 1)
				end
			end
			local tag = m.PrimaryPart and m.PrimaryPart:FindFirstChild("Tag")
			local nameL = tag and tag:FindFirstChild("CritterName")
			if nameL then
				nameL.TextColor3 = Color3.fromHSV(h, 0.6, 1)
			end
		else
			rainbows[m] = nil
		end
	end
end)
