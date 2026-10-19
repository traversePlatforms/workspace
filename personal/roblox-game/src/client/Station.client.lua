-- The station's moving parts on this player's screen (2026-10-18, Matthew's batch): the metal gates rolling down and up
-- with each base's lock, disco balls, trampolines, comets crossing the sky, and extra twinkling stars over the open roof.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local SoundService = game:GetService("SoundService")
local Debris = game:GetService("Debris")

local Config = require(ReplicatedStorage.Shared.Config)
local player = Players.LocalPlayer
local station = workspace:WaitForChild("Station", 30)
if not station then
	return
end

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
	if pos then
		local p = Instance.new("Part")
		p.Anchored, p.CanCollide, p.CanQuery, p.CanTouch, p.Transparency = true, false, false, false, 1
		p.Size = Vector3.new(1, 1, 1)
		p.CFrame = CFrame.new(pos)
		p.Parent = workspace
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

-- ---------- the metal gates ----------
local function hookGate(base)
	local shutter, bar = base:WaitForChild("Shutter", 10), base:WaitForChild("ShutterBar", 10)
	if not (shutter and bar) then
		return
	end
	local top = shutter.CFrame * CFrame.new(0, shutter.Size.Y / 2, 0) -- built rolled up: its top edge is the housing
	local full = shutter:GetAttribute("Full") or 12
	local sx, sz = shutter.Size.X, shutter.Size.Z
	local amount = Instance.new("NumberValue") -- 0 = rolled up, 1 = all the way down
	local function draw()
		local h = 0.2 + (full - 0.2) * amount.Value
		shutter.Size = Vector3.new(sx, h, sz)
		shutter.CFrame = top * CFrame.new(0, -h / 2, 0)
		bar.CFrame = top * CFrame.new(0, -h - 0.25, 0)
	end
	amount.Changed:Connect(draw)
	local down = false
	local function update(instant)
		local want = (base:GetAttribute("ShieldUntil") or 0) > workspace:GetServerTimeNow()
		if want == down then
			return
		end
		down = want
		if instant then
			amount.Value = want and 1 or 0
			return
		end
		local tw = TweenService:Create(amount, TweenInfo.new(want and 0.8 or 1.1, want and Enum.EasingStyle.Bounce or Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { Value = want and 1 or 0 })
		tw:Play()
		if want then
			task.delay(0.45, function()
				sfx("gate", bar.Position)
			end)
		end
	end
	base:GetAttributeChangedSignal("ShieldUntil"):Connect(function()
		update(false)
	end)
	update(true)
end
for _, m in ipairs(station:GetChildren()) do
	if m:IsA("Model") and m:GetAttribute("BaseIndex") then
		task.spawn(hookGate, m)
	end
end

-- ---------- disco balls: spin and throw coloured light while the base's party is on ----------
local PARTY = { Color3.fromRGB(255, 90, 160), Color3.fromRGB(90, 200, 255), Color3.fromRGB(255, 220, 90), Color3.fromRGB(140, 255, 140), Color3.fromRGB(190, 120, 255) }
local clock = 0
RunService.RenderStepped:Connect(function(dt)
	clock += dt
	for _, m in ipairs(station:GetChildren()) do
		if m:IsA("Model") and m:GetAttribute("BaseIndex") then
			local f = m:FindFirstChild("Furniture")
			local ball = f and f:FindFirstChild("DiscoBall", true)
			if ball then
				local on = m:GetAttribute("Disco") == true
				if on then
					ball.CFrame = ball.CFrame * CFrame.Angles(0, dt * 1.5, 0)
				end
				for i, l in ipairs(ball:GetChildren()) do
					if l:IsA("SpotLight") then
						l.Brightness = on and 4 or 0
						l.Color = PARTY[(math.floor(clock * 2) + i) % #PARTY + 1]
					end
				end
			end
		end
	end
end)

-- ---------- trampolines: land on one and you fly ----------
local lastBounce = 0
local function hookTrampoline(p)
	if not (p:IsA("BasePart") and p:GetAttribute("Bounce")) then
		return
	end
	p.Touched:Connect(function(hit)
		local ch = player.Character
		local hrp = ch and ch:FindFirstChild("HumanoidRootPart")
		if not (hrp and hit:IsDescendantOf(ch)) or os.clock() - lastBounce < 0.4 then
			return
		end
		lastBounce = os.clock()
		local v = hrp.AssemblyLinearVelocity
		hrp.AssemblyLinearVelocity = Vector3.new(v.X, p:GetAttribute("Bounce"), v.Z)
		sfx("bounce", p.Position)
	end)
end
for _, d in ipairs(station:GetDescendants()) do
	hookTrampoline(d)
end
station.DescendantAdded:Connect(hookTrampoline)

-- ---------- more stars over the open roof, gently twinkling ----------
local skyFolder = Instance.new("Folder")
skyFolder.Name = "LocalSky"
skyFolder.Parent = workspace
local rng = Random.new(7)
local twinkle = {}
for i = 1, 140 do
	local dir = Vector3.new(rng:NextNumber(-1, 1), rng:NextNumber(0.35, 1), rng:NextNumber(-1, 1)).Unit
	local s = Instance.new("Part")
	s.Name = "SkyStar"
	s.Shape = Enum.PartType.Ball
	local size = rng:NextNumber(1.2, 3.2)
	s.Size = Vector3.new(size, size, size)
	s.Material = Enum.Material.Neon
	s.Color = (i % 5 == 0) and Color3.fromRGB(255, 220, 180) or ((i % 7 == 0) and Color3.fromRGB(180, 220, 255) or Color3.fromRGB(255, 255, 255))
	s.Anchored, s.CanCollide, s.CanQuery, s.CanTouch, s.CastShadow = true, false, false, false, false
	s.CFrame = CFrame.new(dir * rng:NextNumber(650, 900))
	s.Parent = skyFolder
	table.insert(twinkle, { part = s, phase = rng:NextNumber(0, 6.28), speed = rng:NextNumber(0.8, 2.2) })
end
RunService.Heartbeat:Connect(function()
	local t = os.clock()
	for i = 1, #twinkle, 2 do -- half of them twinkle
		local tw = twinkle[i]
		tw.part.Transparency = 0.15 + 0.55 * (0.5 + 0.5 * math.sin(t * tw.speed + tw.phase))
	end
end)

-- ---------- a comet across the sky every couple of minutes ----------
local function comet()
	local angle = rng:NextNumber(0, math.pi * 2)
	local from = Vector3.new(math.cos(angle) * 900, rng:NextNumber(200, 320), math.sin(angle) * 900)
	local to = Vector3.new(-math.cos(angle) * 900, rng:NextNumber(160, 280), -math.sin(angle) * 900) + Vector3.new(rng:NextNumber(-200, 200), 0, rng:NextNumber(-200, 200))
	local head = Instance.new("Part")
	head.Name = "Comet"
	head.Shape = Enum.PartType.Ball
	head.Size = Vector3.new(9, 9, 9)
	head.Material = Enum.Material.Neon
	head.Color = Color3.fromRGB(200, 235, 255)
	head.Anchored, head.CanCollide, head.CanQuery, head.CanTouch, head.CastShadow = true, false, false, false, false
	head.CFrame = CFrame.lookAt(from, to)
	head.Parent = skyFolder
	local a0, a1 = Instance.new("Attachment"), Instance.new("Attachment")
	a0.Position, a1.Position = Vector3.new(0, 4, 0), Vector3.new(0, -4, 0)
	a0.Parent, a1.Parent = head, head
	local trail = Instance.new("Trail")
	trail.Attachment0, trail.Attachment1 = a0, a1
	trail.Lifetime = 3
	trail.LightEmission = 1
	trail.FaceCamera = true
	trail.Color = ColorSequence.new(Color3.fromRGB(220, 240, 255), Color3.fromRGB(150, 200, 255))
	trail.Transparency = NumberSequence.new(0.1, 1)
	trail.WidthScale = NumberSequence.new(1, 0)
	trail.Parent = head
	local sparks = Instance.new("ParticleEmitter")
	sparks.Texture = "rbxasset://textures/particles/sparkles_main.dds"
	sparks.Color = ColorSequence.new(Color3.fromRGB(255, 230, 180))
	sparks.LightEmission = 1
	sparks.Size = NumberSequence.new(2, 0)
	sparks.Lifetime = NumberRange.new(1, 2)
	sparks.Rate = 40
	sparks.Speed = NumberRange.new(2, 6)
	sparks.Parent = head
	sfx("comet")
	local secs = 16
	local tw = TweenService:Create(head, TweenInfo.new(secs, Enum.EasingStyle.Linear), { CFrame = CFrame.lookAt(to, to + (to - from)) })
	tw:Play()
	tw.Completed:Connect(function()
		head:Destroy()
	end)
end
task.spawn(function()
	task.wait(rng:NextNumber(25, 50))
	while true do
		comet()
		task.wait(rng:NextNumber(Config.CometEvery[1], Config.CometEvery[2]))
	end
end)
