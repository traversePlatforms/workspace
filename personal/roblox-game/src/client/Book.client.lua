-- The Critter Collection Book: every critter in the game, the ones you've found in colour and the rest as "???",
-- which Golden and Rainbow versions you've had, and a button to make one of your critters your pet.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage.Shared.Config)
local CritterModels = require(ReplicatedStorage.Shared.CritterModels)
local SetPet = ReplicatedStorage:WaitForChild("Remotes"):WaitForChild("SetPet")

local player = Players.LocalPlayer
local C = Config.Colors

local gui = Instance.new("ScreenGui")
gui.Name = "CollectionBook"
gui.ResetOnSpawn = false
gui.DisplayOrder = 3
gui.Parent = player:WaitForChild("PlayerGui")

local function corner(o, r)
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, r or 12)
	c.Parent = o
end

local function text(parent, props)
	local l = Instance.new("TextLabel")
	l.BackgroundTransparency = 1
	l.Font = Enum.Font.FredokaOne
	l.TextScaled = true
	l.TextColor3 = Color3.new(1, 1, 1)
	for k, v in pairs(props) do
		l[k] = v
	end
	l.Parent = parent
	return l
end

-- the button that opens it (bottom left)
local open = Instance.new("TextButton")
open.Name = "BookButton"
open.AnchorPoint = Vector2.new(0, 1)
local UIS = game:GetService("UserInputService")
if UIS.TouchEnabled and not UIS.KeyboardEnabled then -- clear of the joystick on a tablet (2026-10-18)
	open.AnchorPoint = Vector2.new(0, 0)
	open.Position = UDim2.new(0, 16, 0, 156)
else
	open.Position = UDim2.new(0, 16, 1, -24)
end
open.Size = UDim2.fromOffset(190, 70)
open.BackgroundColor3 = C.Orange
open.Font = Enum.Font.FredokaOne
open.TextScaled = true
open.TextColor3 = C.Dark
open.Text = "Collection Book"
open.Parent = gui
corner(open, 16)
local op = Instance.new("UIPadding")
op.PaddingLeft, op.PaddingRight, op.PaddingTop, op.PaddingBottom = UDim.new(0, 12), UDim.new(0, 12), UDim.new(0, 10), UDim.new(0, 10)
op.Parent = open

local panel = Instance.new("Frame")
panel.Name = "Book"
panel.AnchorPoint = Vector2.new(0.5, 0.5)
panel.Position = UDim2.fromScale(0.5, 0.5)
panel.Size = UDim2.fromScale(0.86, 0.82)
panel.BackgroundColor3 = C.Dark
panel.Visible = false
panel.Parent = gui
corner(panel, 18)
local limit = Instance.new("UISizeConstraint")
limit.MaxSize = Vector2.new(1000, 680)
limit.Parent = panel
local stroke = Instance.new("UIStroke")
stroke.Color = C.Blue
stroke.Thickness = 3
stroke.Parent = panel

text(panel, { Position = UDim2.new(0, 20, 0, 12), Size = UDim2.new(0.6, 0, 0, 44), TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = C.Orange, Text = "Critter Collection" })
local counter = text(panel, { Position = UDim2.new(0, 20, 0, 56), Size = UDim2.new(0.6, 0, 0, 26), TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = C.Blue, Font = Enum.Font.GothamBold, Text = "" })
local close = Instance.new("TextButton")
close.AnchorPoint = Vector2.new(1, 0)
close.Position = UDim2.new(1, -16, 0, 16)
close.Size = UDim2.fromOffset(110, 46)
close.BackgroundColor3 = C.Blue
close.Font = Enum.Font.FredokaOne
close.TextScaled = true
close.TextColor3 = C.Dark
close.Text = "Close"
close.Parent = panel
corner(close, 12)

local scroll = Instance.new("ScrollingFrame")
scroll.Position = UDim2.new(0, 16, 0, 96)
scroll.Size = UDim2.new(1, -32, 1, -112)
scroll.BackgroundTransparency = 1
scroll.BorderSizePixel = 0
scroll.ScrollBarThickness = 8
scroll.AutomaticCanvasSize = Enum.AutomaticSize.Y
scroll.CanvasSize = UDim2.new()
scroll.Parent = panel
local grid = Instance.new("UIGridLayout")
grid.CellSize = UDim2.fromOffset(170, 236)
grid.CellPadding = UDim2.fromOffset(12, 12)
grid.SortOrder = Enum.SortOrder.LayoutOrder
grid.Parent = scroll

local function setOf(attr)
	local s = {}
	for key in string.gmatch(player:GetAttribute(attr) or "", "[^,]+") do
		s[key] = true
	end
	return s
end

local function viewport(parent, def, mut, silhouette)
	local vp = Instance.new("ViewportFrame")
	vp.Size = UDim2.new(1, -12, 0, 118)
	vp.Position = UDim2.new(0, 6, 0, 6)
	vp.BackgroundColor3 = Color3.fromRGB(28, 34, 56)
	vp.Ambient = Color3.fromRGB(190, 195, 215)
	vp.LightColor = Color3.fromRGB(255, 245, 230)
	vp.LightDirection = Vector3.new(-1, -1, 1)
	vp.Parent = parent
	corner(vp, 10)
	local s = CritterModels.scaleFor(def)
	local m = CritterModels.build(def, CFrame.Angles(0, math.rad(25), 0), mut)
	local tag = m.PrimaryPart:FindFirstChild("Tag")
	if tag then
		tag:Destroy()
	end
	if silhouette then
		for _, p in ipairs(m:GetDescendants()) do
			if p:IsA("BasePart") then
				p.Color = Color3.fromRGB(14, 16, 26)
				p.Material = Enum.Material.SmoothPlastic
			elseif p:IsA("Light") or p:IsA("ParticleEmitter") then
				p:Destroy()
			end
		end
	end
	m.Parent = vp
	local cam = Instance.new("Camera")
	cam.FieldOfView = 40
	cam.CFrame = CFrame.lookAt(Vector3.new(0, 1.6 * s, -9 * s), Vector3.new(0, 0.5 * s, 0))
	cam.Parent = vp
	vp.CurrentCamera = cam
end

local function species()
	local list = {}
	for _, def in ipairs(Config.Critters) do
		if def.enabled ~= false then
			table.insert(list, def)
		end
	end
	table.sort(list, function(a, b)
		local ra, rb = Config.Rarities[a.rarity].order, Config.Rarities[b.rarity].order
		if ra ~= rb then
			return ra < rb
		end
		return a.price < b.price
	end)
	return list
end

local function refresh()
	for _, ch in ipairs(scroll:GetChildren()) do
		if ch:IsA("Frame") then
			ch:Destroy()
		end
	end
	local found, owned = setOf("Found"), setOf("Owned")
	local pet = player:GetAttribute("Pet")
	local list = species()
	local nFound = 0
	for i, def in ipairs(list) do
		local has = found[def.id] or found[def.id .. ":golden"] or found[def.id .. ":rainbow"]
		if has then
			nFound += 1
		end
		local rarity = Config.Rarities[def.rarity]
		local card = Instance.new("Frame")
		card.LayoutOrder = i
		card.BackgroundColor3 = Color3.fromRGB(36, 42, 66)
		card.Parent = scroll
		corner(card, 12)
		local cs = Instance.new("UIStroke")
		cs.Color = has and rarity.color or Color3.fromRGB(70, 76, 96)
		cs.Thickness = 2
		cs.Parent = card
		-- show the best version they've had: Rainbow, then Golden, then plain
		local showMut = found[def.id .. ":rainbow"] and Config.mutationById("rainbow") or (found[def.id .. ":golden"] and Config.mutationById("golden") or nil)
		viewport(card, def, showMut, not has)
		text(card, { Position = UDim2.new(0, 6, 0, 128), Size = UDim2.new(1, -12, 0, 24), Text = has and def.name or "???" })
		text(card, { Position = UDim2.new(0, 6, 0, 152), Size = UDim2.new(1, -12, 0, 18), Font = Enum.Font.GothamBold, TextColor3 = rarity.color, Text = def.rarity .. (has and ("  ·  +" .. def.income .. "/s") or "") })
		-- which special versions they've had
		for j, mid in ipairs({ "golden", "rainbow" }) do
			local got = found[def.id .. ":" .. mid]
			local chip = text(card, { Position = UDim2.new((j - 1) * 0.5, 6, 0, 174), Size = UDim2.new(0.5, -9, 0, 20), Font = Enum.Font.GothamBold,
				TextColor3 = got and C.Dark or Color3.fromRGB(110, 116, 136), BackgroundTransparency = 0,
				BackgroundColor3 = got and (mid == "golden" and Color3.fromRGB(255, 205, 70) or Color3.fromRGB(200, 150, 255)) or Color3.fromRGB(46, 52, 76),
				Text = mid == "golden" and "Golden" or "Rainbow" })
			corner(chip, 8)
		end
		-- make it your pet, if one is in your base right now
		local ownKey = owned[def.id .. ":rainbow"] and (def.id .. ":rainbow") or (owned[def.id .. ":golden"] and (def.id .. ":golden") or (owned[def.id] and def.id or nil))
		if ownKey then
			local isPet = pet and Config.fromKey(pet) == def
			local b = Instance.new("TextButton")
			b.Position = UDim2.new(0, 6, 0, 200)
			b.Size = UDim2.new(1, -12, 0, 28)
			b.BackgroundColor3 = isPet and C.Orange or C.Blue
			b.Font = Enum.Font.FredokaOne
			b.TextScaled = true
			b.TextColor3 = C.Dark
			b.Text = isPet and "Following you (tap to stop)" or "Make my pet"
			b.Parent = card
			corner(b, 8)
			b.Activated:Connect(function()
				SetPet:FireServer(isPet and "" or ownKey)
			end)
		end
	end
	counter.Text = "Found " .. nFound .. " of " .. #list .. " critters"
end

open.Activated:Connect(function()
	panel.Visible = not panel.Visible
	if panel.Visible then
		refresh()
	end
end)
close.Activated:Connect(function()
	panel.Visible = false
end)
for _, attr in ipairs({ "Found", "Owned", "Pet" }) do
	player:GetAttributeChangedSignal(attr):Connect(function()
		if panel.Visible then
			refresh()
		end
	end)
end
