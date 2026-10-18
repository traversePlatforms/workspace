-- The "juice", drawn on this player's screen only: sparkles and confetti, pop-up numbers, the steal alarm, a guide beam
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

FX.OnClientEvent:Connect(function(kind, a, b)
	if kind == "burst" then
		burst(a, b)
	elseif kind == "confetti" then
		burst(a, nil, 60, ColorSequence.new({ ColorSequenceKeypoint.new(0, C.Orange), ColorSequenceKeypoint.new(0.5, C.Blue), ColorSequenceKeypoint.new(1, C.Orange) }))
	elseif kind == "pop" then
		pop(a, b)
	elseif kind == "alarm" then
		alarm(a)
	elseif kind == "shower" then
		shout("METEOR SHOWER!", C.Blue, 3)
	elseif kind == "night" then
		shout("BLACK HOLE NIGHT!", Color3.fromRGB(200, 140, 255), 3)
	elseif kind == "booped" then
		shout("BOOP!", Color3.fromRGB(200, 140, 255), 1.5)
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

local keep = { Eye = true, Pupil = true, Nose = true }
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
			for _, p in ipairs(m:GetDescendants()) do
				if p:IsA("BasePart") and not keep[p.Name] then
					p.Color = Color3.fromHSV((h + (p.Name == "Body" and 0 or 0.15)) % 1, 0.55, 1)
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
