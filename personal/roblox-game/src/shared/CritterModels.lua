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

function CritterModels.scaleFor(def)
	local order = Config.Rarities[def.rarity].order
	return 0.8 + (order - 1) * 0.22
end

-- returns a Model whose PrimaryPart ("Body") is anchored at `cframe`; every other part is welded to it
function CritterModels.build(def, cframe)
	local s = CritterModels.scaleFor(def)
	local model = Instance.new("Model")
	model.Name = def.name
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
		sparkle.Rate = rarity.order == 5 and 18 or 8
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
	nameL.Text = def.name
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
