-- What each player sees: the title screen, their Stardust, the airlock button, messages, and a marker over their own base.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")
local RunService = game:GetService("RunService")

local Config = require(ReplicatedStorage.Shared.Config)
local remotes = ReplicatedStorage:WaitForChild("Remotes")
local Notify = remotes:WaitForChild("Notify")
local ShieldRequest = remotes:WaitForChild("ShieldRequest")

local player = Players.LocalPlayer
local C = Config.Colors

local gui = Instance.new("ScreenGui")
gui.Name = "StarStationHUD"
gui.ResetOnSpawn = false
gui.IgnoreGuiInset = true
gui.Parent = player:WaitForChild("PlayerGui")

local function corner(obj, r)
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, r or 12)
	c.Parent = obj
end

local function label(parent, props)
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

-- ---------- Stardust counter (top left) ----------
local panel = Instance.new("Frame")
panel.Name = "Stardust"
panel.Position = UDim2.new(0, 16, 0, 60)
panel.Size = UDim2.fromOffset(260, 86)
panel.BackgroundColor3 = C.Dark
panel.BackgroundTransparency = 0.15
panel.Parent = gui
corner(panel, 16)
local stroke = Instance.new("UIStroke")
stroke.Color = C.Orange
stroke.Thickness = 2
stroke.Parent = panel
local dustL = label(panel, { Position = UDim2.new(0, 14, 0, 6), Size = UDim2.new(1, -28, 0, 46), TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = C.Orange, Text = "★ 0" })
local incomeL = label(panel, { Position = UDim2.new(0, 14, 0, 52), Size = UDim2.new(1, -28, 0, 26), TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = C.Blue, Font = Enum.Font.GothamBold, Text = "+0 Stardust / second" })

local function commas(n)
	local s = tostring(math.floor(n or 0))
	local out = s:reverse():gsub("(%d%d%d)", "%1,"):reverse()
	return (out:gsub("^,", ""))
end

local function refreshDust()
	dustL.Text = "★ " .. commas(player:GetAttribute("Stardust"))
	incomeL.Text = "+" .. commas(player:GetAttribute("Income")) .. " Stardust / second"
end
player:GetAttributeChangedSignal("Stardust"):Connect(refreshDust)
player:GetAttributeChangedSignal("Income"):Connect(refreshDust)
refreshDust()

-- ---------- airlock button (bottom right) ----------
local shieldBtn = Instance.new("TextButton")
shieldBtn.Name = "Airlock"
shieldBtn.AnchorPoint = Vector2.new(1, 1)
shieldBtn.Position = UDim2.new(1, -16, 1, -24)
shieldBtn.Size = UDim2.fromOffset(230, 70)
shieldBtn.BackgroundColor3 = C.Blue
shieldBtn.Font = Enum.Font.FredokaOne
shieldBtn.TextScaled = true
shieldBtn.TextColor3 = C.Dark
shieldBtn.Text = "Close Airlock"
shieldBtn.Parent = gui
corner(shieldBtn, 16)
local pad = Instance.new("UIPadding")
pad.PaddingLeft = UDim.new(0, 12)
pad.PaddingRight = UDim.new(0, 12)
pad.PaddingTop = UDim.new(0, 10)
pad.PaddingBottom = UDim.new(0, 10)
pad.Parent = shieldBtn
shieldBtn.Activated:Connect(function()
	ShieldRequest:FireServer()
end)

-- ---------- expand base button (above the airlock) ----------
local Expand = remotes:WaitForChild("Expand")
local expandBtn = Instance.new("TextButton")
expandBtn.Name = "ExpandBase"
expandBtn.AnchorPoint = Vector2.new(1, 1)
expandBtn.Position = UDim2.new(1, -16, 1, -104)
expandBtn.Size = UDim2.fromOffset(230, 52)
expandBtn.BackgroundColor3 = C.Orange
expandBtn.Font = Enum.Font.FredokaOne
expandBtn.TextScaled = true
expandBtn.TextColor3 = C.Dark
expandBtn.Parent = gui
corner(expandBtn, 14)
local ep = Instance.new("UIPadding")
ep.PaddingLeft, ep.PaddingRight, ep.PaddingTop, ep.PaddingBottom = UDim.new(0, 10), UDim.new(0, 10), UDim.new(0, 8), UDim.new(0, 8)
ep.Parent = expandBtn
local function refreshExpand()
	local cost = player:GetAttribute("NextExpand") or 0
	if cost > 0 then
		expandBtn.Text = "Expand Base: " .. commas(cost) .. " ★"
		expandBtn.AutoButtonColor = true
		expandBtn.BackgroundColor3 = C.Orange
	else
		expandBtn.Text = "Base is full size"
		expandBtn.BackgroundColor3 = Color3.fromRGB(120, 128, 150)
	end
end
player:GetAttributeChangedSignal("NextExpand"):Connect(refreshExpand)
refreshExpand()
expandBtn.Activated:Connect(function()
	Expand:FireServer()
end)

local function myBase()
	local station = workspace:FindFirstChild("Station")
	if not station then
		return nil
	end
	for _, m in ipairs(station:GetChildren()) do
		if m:IsA("Model") and m:GetAttribute("OwnerUserId") == player.UserId then
			return m
		end
	end
	return nil
end

-- ---------- "YOUR BASE" marker, only on your own screen ----------
local marker = nil
local function updateMarker()
	local base = myBase()
	if marker and (not base or marker.Adornee ~= base.PrimaryPart) then
		marker:Destroy()
		marker = nil
	end
	if base and base.PrimaryPart and not marker then
		marker = Instance.new("BillboardGui")
		marker.Name = "YourBaseMarker"
		marker.Adornee = base.PrimaryPart
		marker.Size = UDim2.fromOffset(260, 70)
		marker.StudsOffsetWorldSpace = Vector3.new(0, 24, 0)
		marker.AlwaysOnTop = true
		marker.LightInfluence = 0
		marker.Parent = gui
		label(marker, { Size = UDim2.fromScale(1, 1), TextColor3 = C.Orange, TextStrokeTransparency = 0.2, Text = "▼ YOUR BASE ▼" })
	end
end

RunService.Heartbeat:Connect(function()
	local base = myBase()
	local t = workspace:GetServerTimeNow()
	if base then
		local su, cu = base:GetAttribute("ShieldUntil") or 0, base:GetAttribute("CooldownUntil") or 0
		if su > t then
			shieldBtn.Text = "Airlock closed: " .. math.ceil(su - t) .. "s"
			shieldBtn.BackgroundColor3 = C.Orange
		elseif cu > t then
			shieldBtn.Text = "Recharging: " .. math.ceil(cu - t) .. "s"
			shieldBtn.BackgroundColor3 = Color3.fromRGB(120, 128, 150)
		else
			shieldBtn.Text = "Close Airlock"
			shieldBtn.BackgroundColor3 = C.Blue
		end
	end
	updateMarker()
end)

-- ---------- hide "Steal" on your own critters ----------
local function checkPrompt(obj)
	if obj:IsA("ProximityPrompt") then
		if obj:GetAttribute("OwnerUserId") == player.UserId then
			obj.MaxActivationDistance = 0 -- no Steal on your own critters (the server never changes this, so it stays hidden)
		end
		local only = obj:GetAttribute("OnlyFor")
		if only and only ~= player.UserId then
			obj.MaxActivationDistance = 0 -- Sell shows only for the owner
		end
	end
end
for _, d in ipairs(workspace:GetDescendants()) do
	checkPrompt(d)
end
workspace.DescendantAdded:Connect(checkPrompt)

-- ---------- messages (top middle) ----------
local toasts = Instance.new("Frame")
toasts.Name = "Messages"
toasts.AnchorPoint = Vector2.new(0.5, 0)
toasts.Position = UDim2.new(0.5, 0, 0, 70)
toasts.Size = UDim2.fromOffset(560, 300)
toasts.BackgroundTransparency = 1
toasts.Parent = gui
local list = Instance.new("UIListLayout")
list.Padding = UDim.new(0, 8)
list.HorizontalAlignment = Enum.HorizontalAlignment.Center
list.SortOrder = Enum.SortOrder.LayoutOrder
list.Parent = toasts

local KIND = {
	info = { bg = C.Dark, fg = Color3.new(1, 1, 1) },
	good = { bg = Color3.fromRGB(40, 110, 80), fg = Color3.new(1, 1, 1) },
	bad = { bg = Color3.fromRGB(150, 50, 60), fg = Color3.new(1, 1, 1) },
	rare = { bg = Color3.fromRGB(150, 110, 20), fg = Color3.new(1, 1, 1) },
	cosmic = { bg = Color3.fromRGB(170, 60, 140), fg = Color3.new(1, 1, 1) },
}
local order = 0
Notify.OnClientEvent:Connect(function(text, kind)
	local k = KIND[kind] or KIND.info
	order += 1
	local f = Instance.new("TextLabel")
	f.LayoutOrder = order
	f.Size = UDim2.fromOffset(540, 46)
	f.BackgroundColor3 = k.bg
	f.BackgroundTransparency = 0.1
	f.Font = Enum.Font.FredokaOne
	f.TextScaled = true
	f.TextColor3 = k.fg
	f.Text = text
	f.Parent = toasts
	corner(f, 12)
	local p = Instance.new("UIPadding")
	p.PaddingLeft = UDim.new(0, 12)
	p.PaddingRight = UDim.new(0, 12)
	p.PaddingTop = UDim.new(0, 6)
	p.PaddingBottom = UDim.new(0, 6)
	p.Parent = f
	task.delay(kind == "cosmic" and 6 or 3.5, function()
		local tw = TweenService:Create(f, TweenInfo.new(0.4), { BackgroundTransparency = 1, TextTransparency = 1 })
		tw:Play()
		tw.Completed:Wait()
		f:Destroy()
	end)
	while #toasts:GetChildren() > 6 do -- keep the stack short
		for _, ch in ipairs(toasts:GetChildren()) do
			if ch:IsA("TextLabel") then
				ch:Destroy()
				break
			end
		end
	end
end)

-- ---------- title screen ----------
local title = Instance.new("Frame")
title.Name = "TitleScreen"
title.Size = UDim2.fromScale(1, 1)
title.BackgroundColor3 = C.Dark
title.ZIndex = 10
title.Parent = gui
local grad = Instance.new("UIGradient")
grad.Color = ColorSequence.new(Color3.fromRGB(20, 26, 48), Color3.fromRGB(10, 12, 22))
grad.Rotation = 90
grad.Parent = title
label(title, { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.34), Size = UDim2.fromScale(0.8, 0.16), TextColor3 = C.Orange, ZIndex = 11, Text = Config.GameTitle })
label(title, { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.48), Size = UDim2.fromScale(0.7, 0.06), TextColor3 = C.Blue, Font = Enum.Font.GothamBold, ZIndex = 11,
	Text = "Grab space critters. Guard your base. Catch the thieves!" })
local play = Instance.new("TextButton")
play.AnchorPoint = Vector2.new(0.5, 0.5)
play.Position = UDim2.fromScale(0.5, 0.65)
play.Size = UDim2.fromOffset(260, 80)
play.BackgroundColor3 = C.Blue
play.Font = Enum.Font.FredokaOne
play.TextScaled = true
play.TextColor3 = C.Dark
play.Text = "PLAY"
play.ZIndex = 11
play.Parent = title
corner(play, 20)
play.Activated:Connect(function()
	local tw = TweenService:Create(title, TweenInfo.new(0.5), { BackgroundTransparency = 1 })
	for _, ch in ipairs(title:GetChildren()) do
		if ch:IsA("TextLabel") or ch:IsA("TextButton") then
			ch.Visible = false
		end
	end
	tw:Play()
	tw.Completed:Wait()
	title:Destroy()
end)
