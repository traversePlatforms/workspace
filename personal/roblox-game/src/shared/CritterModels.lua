-- Builds each space critter out of simple shapes (no imported meshes needed), so every critter is code you can change.
local Config = require(script.Parent.Config)

local CritterModels = {}

local function newPart(model, body, name, size, color, offset, opts)
	opts = opts or {}
	local p = Instance.new(opts.wedge and "WedgePart" or "Part")
	p.Name = name
	p.Size = size
	p.Color = color
	p.Material = opts.material or Enum.Material.SmoothPlastic
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.Massless = true
	p.Anchored = false
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	if opts.ball then
		local m = Instance.new("SpecialMesh")
		m.MeshType = Enum.MeshType.Sphere
		m.Parent = p
	elseif opts.cylinder then
		p.Shape = Enum.PartType.Cylinder
	end
	p.CFrame = body.CFrame * offset
	local w = Instance.new("WeldConstraint")
	w.Part0 = body
	w.Part1 = p
	w.Parent = p
	p.Parent = model
	return p
end

-- front of a critter faces -Z (Roblox's LookVector)
local function addEyes(model, body, s, spread, height, depth)
	for _, side in ipairs({ -1, 1 }) do
		newPart(model, body, "Eye", Vector3.new(0.75, 0.85, 0.4) * s, Color3.new(1, 1, 1),
			CFrame.new(side * spread * s, height * s, -depth * s), { ball = true })
		newPart(model, body, "Pupil", Vector3.new(0.4, 0.5, 0.25) * s, Config.Colors.Dark,
			CFrame.new(side * spread * s, height * s, -(depth + 0.17) * s), { ball = true })
	end
end

local SHAPES = {}

function SHAPES.blob(model, body, def, s)
	addEyes(model, body, s, 0.45, 0.25, 1.25)
end

function SHAPES.bunny(model, body, def, s)
	addEyes(model, body, s, 0.45, 0.3, 1.3)
	for _, side in ipairs({ -1, 1 }) do
		newPart(model, body, "Ear", Vector3.new(0.55, 2.2, 0.35) * s, def.body, CFrame.new(side * 0.5 * s, 2.1 * s, 0) * CFrame.Angles(0, 0, side * -0.15), { ball = true })
		newPart(model, body, "EarInner", Vector3.new(0.3, 1.7, 0.2) * s, def.accent, CFrame.new(side * 0.5 * s, 2.1 * s, -0.1 * s) * CFrame.Angles(0, 0, side * -0.15), { ball = true })
	end
	newPart(model, body, "Tail", Vector3.new(0.9, 0.9, 0.9) * s, Color3.new(1, 1, 1), CFrame.new(0, -0.4 * s, 1.5 * s), { ball = true })
end

function SHAPES.cat(model, body, def, s)
	addEyes(model, body, s, 0.45, 0.3, 1.3)
	for _, side in ipairs({ -1, 1 }) do
		newPart(model, body, "Ear", Vector3.new(0.3, 1.0, 0.9) * s, def.body, CFrame.new(side * 0.75 * s, 1.55 * s, -0.2 * s) * CFrame.Angles(0, math.rad(90), 0), { wedge = true })
	end
	newPart(model, body, "Nose", Vector3.new(0.35, 0.25, 0.2) * s, Color3.fromRGB(255, 160, 175), CFrame.new(0, -0.05 * s, -1.5 * s), { ball = true })
	newPart(model, body, "Tail", Vector3.new(2.6, 0.45, 0.45) * s, def.accent, CFrame.new(0, 0.5 * s, 1.9 * s) * CFrame.Angles(0, math.rad(90), math.rad(-55)), { cylinder = true })
	if def.stripes then
		for i, x in ipairs({ -0.75, 0, 0.75 }) do
			newPart(model, body, "Stripe" .. i, Vector3.new(0.28, 0.2, 2.4) * s, def.accent, CFrame.new(x * s, 1.42 * s - math.abs(x) * 0.35 * s, 0.1 * s) * CFrame.Angles(0, 0, -x * 0.5))
		end
		for i, x in ipairs({ -0.25, 0.25 }) do -- the little "M" on a tabby's forehead
			newPart(model, body, "Brow" .. i, Vector3.new(0.12, 0.55, 0.12) * s, def.accent, CFrame.new(x * s, 0.95 * s, -1.25 * s) * CFrame.Angles(0, 0, x * 1.2))
		end
	end
end

function SHAPES.pup(model, body, def, s)
	addEyes(model, body, s, 0.45, 0.35, 1.3)
	newPart(model, body, "Snout", Vector3.new(1.0, 0.7, 0.8) * s, def.accent, CFrame.new(0, -0.2 * s, -1.45 * s), { ball = true })
	newPart(model, body, "Nose", Vector3.new(0.35, 0.25, 0.2) * s, Config.Colors.Dark, CFrame.new(0, -0.05 * s, -1.85 * s), { ball = true })
	for _, side in ipairs({ -1, 1 }) do
		newPart(model, body, "Ear", Vector3.new(0.45, 1.4, 0.7) * s, def.accent, CFrame.new(side * 1.25 * s, 0.6 * s, -0.1 * s) * CFrame.Angles(0, 0, side * 0.25), { ball = true })
	end
	newPart(model, body, "Tail", Vector3.new(1.4, 0.4, 0.4) * s, def.body, CFrame.new(0, 0.6 * s, 1.6 * s) * CFrame.Angles(0, math.rad(90), math.rad(-40)), { cylinder = true })
end

function SHAPES.alien(model, body, def, s)
	addEyes(model, body, s, 0.45, 0.3, 1.25)
	newPart(model, body, "Antenna", Vector3.new(1.4, 0.15, 0.15) * s, def.accent, CFrame.new(0, 2.0 * s, 0) * CFrame.Angles(0, 0, math.rad(90)), { cylinder = true })
	local tip = newPart(model, body, "AntennaTip", Vector3.new(0.5, 0.5, 0.5) * s, def.accent, CFrame.new(0, 2.75 * s, 0), { ball = true, material = Enum.Material.Neon })
	local light = Instance.new("PointLight")
	light.Color = def.accent
	light.Range = 8
	light.Brightness = 1.5
	light.Parent = tip
end

function SHAPES.bear(model, body, def, s)
	addEyes(model, body, s, 0.45, 0.35, 1.3)
	newPart(model, body, "Snout", Vector3.new(1.0, 0.7, 0.6) * s, def.accent, CFrame.new(0, -0.25 * s, -1.4 * s), { ball = true })
	for _, side in ipairs({ -1, 1 }) do
		newPart(model, body, "Ear", Vector3.new(0.8, 0.8, 0.4) * s, def.body, CFrame.new(side * 0.95 * s, 1.35 * s, 0), { ball = true })
	end
	newPart(model, body, "Star", Vector3.new(0.6, 0.6, 0.15) * s, def.accent, CFrame.new(0, -0.7 * s, -1.38 * s), { ball = true, material = Enum.Material.Neon })
end

function SHAPES.dragon(model, body, def, s)
	addEyes(model, body, s, 0.45, 0.35, 1.3)
	for _, side in ipairs({ -1, 1 }) do
		newPart(model, body, "Horn", Vector3.new(0.25, 1.0, 0.25) * s, def.accent, CFrame.new(side * 0.55 * s, 1.6 * s, 0.1 * s) * CFrame.Angles(0, 0, side * -0.3))
		newPart(model, body, "Wing", Vector3.new(2.2, 0.15, 1.4) * s, def.accent, CFrame.new(side * 2.0 * s, 0.6 * s, 0.4 * s) * CFrame.Angles(0, 0, side * 0.45), { material = Enum.Material.Neon })
	end
	newPart(model, body, "Tail", Vector3.new(2.4, 0.5, 0.5) * s, def.body, CFrame.new(0, -0.2 * s, 2.0 * s) * CFrame.Angles(0, math.rad(90), math.rad(-15)), { cylinder = true })
end

-- wave 3 body types (2026-10-18): jellyfish, robot, bird, turtle, octopus
function SHAPES.jelly(model, body, def, s)
	addEyes(model, body, s, 0.42, 0.35, 1.25)
	newPart(model, body, "Rim", Vector3.new(3.4, 0.5, 3.4) * s, def.accent, CFrame.new(0, -0.6 * s, 0), { ball = true })
	for i = 0, 5 do
		local a = i / 6 * math.pi * 2
		local x, z = math.cos(a) * 0.9 * s, math.sin(a) * 0.9 * s
		newPart(model, body, "Tentacle", Vector3.new(2.2, 0.3, 0.3) * s, def.accent, CFrame.new(x, -1.7 * s, z) * CFrame.Angles(0, 0, math.rad(90 + (i % 2 == 0 and 8 or -8))), { cylinder = true })
		newPart(model, body, "TentacleTip", Vector3.new(0.4, 0.4, 0.4) * s, def.glow or def.accent, CFrame.new(x, -2.8 * s, z), { ball = true, material = Enum.Material.Neon })
	end
end

function SHAPES.robot(model, body, def, s)
	body.Transparency = 1 -- the robot is all box: the round body only carries it
	newPart(model, body, "Chassis", Vector3.new(2.8, 2.6, 2.4) * s, def.body, CFrame.new(0, 0, 0), { material = Enum.Material.Metal })
	newPart(model, body, "Visor", Vector3.new(2.2, 1.1, 0.2) * s, Config.Colors.Dark, CFrame.new(0, 0.45 * s, -1.22 * s))
	for _, side in ipairs({ -1, 1 }) do
		newPart(model, body, "EyeLight", Vector3.new(0.45, 0.45, 0.15) * s, def.accent, CFrame.new(side * 0.5 * s, 0.45 * s, -1.34 * s), { ball = true, material = Enum.Material.Neon })
		newPart(model, body, "Arm", Vector3.new(0.5, 1.6, 0.5) * s, def.accent, CFrame.new(side * 1.65 * s, -0.2 * s, 0) * CFrame.Angles(0, 0, side * 0.25), { material = Enum.Material.Metal })
		newPart(model, body, "Foot", Vector3.new(0.9, 0.5, 1.2) * s, def.accent, CFrame.new(side * 0.7 * s, -1.5 * s, 0), { material = Enum.Material.Metal })
	end
	newPart(model, body, "Antenna", Vector3.new(1.2, 0.15, 0.15) * s, def.accent, CFrame.new(0, 1.8 * s, 0) * CFrame.Angles(0, 0, math.rad(90)), { cylinder = true })
	newPart(model, body, "AntennaTip", Vector3.new(0.45, 0.45, 0.45) * s, def.glow or def.accent, CFrame.new(0, 2.45 * s, 0), { ball = true, material = Enum.Material.Neon })
	newPart(model, body, "Badge", Vector3.new(0.7, 0.7, 0.12) * s, def.glow or Config.Colors.Orange, CFrame.new(0, -0.6 * s, -1.24 * s), { ball = true, material = Enum.Material.Neon })
end

function SHAPES.bird(model, body, def, s)
	addEyes(model, body, s, 0.45, 0.4, 1.28)
	newPart(model, body, "Beak", Vector3.new(0.5, 0.6, 0.8) * s, Color3.fromRGB(255, 170, 60), CFrame.new(0, 0.0, -1.6 * s) * CFrame.Angles(math.rad(90), 0, 0), { wedge = true })
	for _, side in ipairs({ -1, 1 }) do
		newPart(model, body, "Wing", Vector3.new(0.5, 1.8, 2.0) * s, def.accent, CFrame.new(side * 1.5 * s, 0, 0.2 * s) * CFrame.Angles(0, 0, side * 0.35), { ball = true })
		newPart(model, body, "Foot", Vector3.new(0.6, 0.25, 0.7) * s, Color3.fromRGB(255, 170, 60), CFrame.new(side * 0.5 * s, -1.5 * s, -0.2 * s), { ball = true })
	end
	newPart(model, body, "Tuft", Vector3.new(0.4, 1.0, 0.4) * s, def.accent, CFrame.new(0, 1.7 * s, -0.2 * s) * CFrame.Angles(math.rad(-20), 0, 0), { ball = true })
end

function SHAPES.turtle(model, body, def, s)
	-- the round body is the shell; a head pokes out the front
	newPart(model, body, "ShellRim", Vector3.new(3.5, 0.6, 3.5) * s, def.accent, CFrame.new(0, -0.7 * s, 0), { ball = true })
	for i, x in ipairs({ -0.7, 0, 0.7 }) do
		newPart(model, body, "ShellSpot" .. i, Vector3.new(0.8, 0.3, 0.8) * s, def.accent, CFrame.new(x * s, 1.38 * s - math.abs(x) * 0.25 * s, 0.1 * s), { ball = true })
	end
	local skin = def.glow or Color3.fromRGB(150, 210, 140)
	newPart(model, body, "Head", Vector3.new(1.4, 1.3, 1.4) * s, skin, CFrame.new(0, -0.2 * s, -1.9 * s), { ball = true })
	for _, side in ipairs({ -1, 1 }) do
		newPart(model, body, "Eye", Vector3.new(0.45, 0.5, 0.3) * s, Color3.new(1, 1, 1), CFrame.new(side * 0.32 * s, 0.05 * s, -2.5 * s), { ball = true })
		newPart(model, body, "Pupil", Vector3.new(0.25, 0.3, 0.2) * s, Config.Colors.Dark, CFrame.new(side * 0.32 * s, 0.05 * s, -2.62 * s), { ball = true })
		for _, fz in ipairs({ -0.9, 0.9 }) do
			newPart(model, body, "Leg", Vector3.new(0.8, 0.6, 0.8) * s, skin, CFrame.new(side * 1.3 * s, -1.0 * s, fz * s), { ball = true })
		end
	end
end

function SHAPES.octo(model, body, def, s)
	addEyes(model, body, s, 0.45, 0.2, 1.25)
	for i = 0, 7 do
		local a = i / 8 * math.pi * 2
		local dir = Vector3.new(math.cos(a), 0, math.sin(a))
		local p = dir * 1.5 * s + Vector3.new(0, -1.3 * s, 0)
		newPart(model, body, "Arm", Vector3.new(0.55, 0.45, 1.8) * s, def.accent, CFrame.lookAt(p, p + dir) * CFrame.Angles(math.rad(-15), 0, 0), { ball = true })
	end
	newPart(model, body, "Spot", Vector3.new(0.7, 0.5, 0.15) * s, def.glow or def.accent, CFrame.new(0.6 * s, 1.0 * s, -1.0 * s), { ball = true, material = Enum.Material.Neon })
end

function CritterModels.scaleFor(def)
	local order = Config.Rarities[def.rarity].order
	return 0.8 + (order - 1) * 0.22
end

-- returns a Model whose PrimaryPart ("Body") is anchored at `cframe`; every other part is welded to it
-- mut (optional): a Config.Mutations entry; Golden repaints the critter gold, Rainbow is colour-cycled on each screen
function CritterModels.build(def, cframe, mut)
	local s = CritterModels.scaleFor(def)
	local model = Instance.new("Model")
	model.Name = mut and (mut.name .. " " .. def.name) or def.name
	local body = Instance.new("Part")
	body.Name = "Body"
	body.Shape = Enum.PartType.Ball
	body.Size = Vector3.new(3, 3, 3) * s
	body.Color = def.body
	body.Material = Enum.Material.SmoothPlastic
	body.TopSurface = Enum.SurfaceType.Smooth
	body.BottomSurface = Enum.SurfaceType.Smooth
	body.Anchored = true
	body.CanCollide = false
	body.CanTouch = false
	body.CFrame = cframe
	body.Parent = model
	model.PrimaryPart = body
	;(SHAPES[def.shape] or SHAPES.blob)(model, body, def, s)

	local rarity = Config.Rarities[def.rarity]
	if rarity.order >= 4 then -- Legendary and Cosmic glow
		local light = Instance.new("PointLight")
		light.Color = def.glow or rarity.color
		light.Range = 14
		light.Brightness = 2
		light.Parent = body
		local sparkle = Instance.new("ParticleEmitter")
		sparkle.Texture = "rbxasset://textures/particles/sparkles_main.dds"
		sparkle.Color = ColorSequence.new(def.glow or rarity.color)
		sparkle.Rate = def.rarity == "Cosmic" and 18 or (def.rarity == "Mythic" and 12 or 8)
		sparkle.Lifetime = NumberRange.new(0.8, 1.4)
		sparkle.Speed = NumberRange.new(1, 3)
		sparkle.Size = NumberSequence.new(0.35)
		sparkle.LightEmission = 1
		sparkle.Parent = body
	end

	local tag = Instance.new("BillboardGui")
	tag.Name = "Tag"
	tag.Size = UDim2.fromOffset(220, 60)
	tag.StudsOffsetWorldSpace = Vector3.new(0, 2.6 * s + 1.5, 0)
	tag.AlwaysOnTop = false
	tag.MaxDistance = 80
	tag.Parent = body
	local nameL = Instance.new("TextLabel")
	nameL.Name = "CritterName"
	nameL.Size = UDim2.new(1, 0, 0.55, 0)
	nameL.BackgroundTransparency = 1
	nameL.Font = Enum.Font.FredokaOne
	nameL.TextScaled = true
	nameL.TextColor3 = rarity.color
	nameL.TextStrokeTransparency = 0.3
	nameL.Text = model.Name
	nameL.Parent = tag
	local infoL = Instance.new("TextLabel")
	infoL.Name = "Info"
	infoL.Position = UDim2.new(0, 0, 0.55, 0)
	infoL.Size = UDim2.new(1, 0, 0.45, 0)
	infoL.BackgroundTransparency = 1
	infoL.Font = Enum.Font.GothamBold
	infoL.TextScaled = true
	infoL.TextColor3 = Color3.new(1, 1, 1)
	infoL.TextStrokeTransparency = 0.4
	infoL.Text = def.rarity
	infoL.Parent = tag

	model:SetAttribute("CritterId", def.id)

	if mut then
		model:SetAttribute("Mutation", mut.id)
		local keep = { Eye = true, Pupil = true, Nose = true }
		if mut.id == "golden" then
			for _, p in ipairs(model:GetDescendants()) do
				if p:IsA("BasePart") and not keep[p.Name] then
					p.Color = (p == body) and mut.color or mut.color:Lerp(Color3.fromRGB(200, 140, 30), 0.35)
					p.Material = Enum.Material.Foil
				end
			end
			nameL.TextColor3 = mut.color
		elseif mut.id == "rainbow" then
			model:SetAttribute("Rainbow", true) -- FX.client.lua cycles the colours
		end
		local shine = Instance.new("ParticleEmitter")
		shine.Texture = "rbxasset://textures/particles/sparkles_main.dds"
		shine.Color = mut.id == "rainbow" and ColorSequence.new({
			ColorSequenceKeypoint.new(0, Color3.fromRGB(255, 120, 120)),
			ColorSequenceKeypoint.new(0.33, Color3.fromRGB(255, 230, 120)),
			ColorSequenceKeypoint.new(0.66, Color3.fromRGB(120, 220, 255)),
			ColorSequenceKeypoint.new(1, Color3.fromRGB(220, 140, 255)),
		}) or ColorSequence.new(mut.color)
		shine.Rate = 10
		shine.Lifetime = NumberRange.new(0.6, 1.2)
		shine.Speed = NumberRange.new(0.5, 2)
		shine.Size = NumberSequence.new(0.3)
		shine.LightEmission = 1
		shine.Parent = body
	end
	return model
end

function CritterModels.setInfo(model, text)
	local body = model.PrimaryPart
	local tag = body and body:FindFirstChild("Tag")
	local info = tag and tag:FindFirstChild("Info")
	if info then
		info.Text = text
	end
end

return CritterModels
