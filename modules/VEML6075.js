// ============================================================================================
// --- BREAKOUT GARDENER :: MODULES :: VEML6075 ---
// (c) 2018-2019 Karl-Henrik Henriksson - breakouts*xoblite.net - http://breakouts.xoblite.net/
// ============================================================================================

const i2c = require('i2c-bus'); // -> https://github.com/fivdi/i2c-bus
const SH1107 = require('./SH1107.js');
const IS31FL3731_RGB = require('./IS31FL3731_RGB.js');
const IS31FL3731_WHITE = require('./IS31FL3731_WHITE.js');
const HT16K33 = require('./HT16K33.js');
const DRV2605 = require('./DRV2605.js');

module.exports = {
	Identify: Identify,
	IsAvailable: IsAvailable,
	Start: Start,
	Stop: Stop,
	Get: Get,
	Log: Log,
	Display: Display
};

// ================================================================================

// ----------------------------------------------------------------------------------------
// === Vishay Semiconductors VEML6075 UVA and UVB Light Sensor ===
// * Product Page -> https://www.vishay.com/ppg?84304
// * Datasheet -> https://www.vishay.com/docs/84304/veml6075.pdf
// * Application Note -> https://www.vishay.com/docs/84339/designingveml6075.pdf
// * Adafruit Learn -> https://learn.adafruit.com/adafruit-veml6075-uva-uvb-uv-index-sensor/
// ----------------------------------------------------------------------------------------

var I2C_BUS = 0, I2C_ADDRESS_VEML6075 = 0;
var data = [0.0, 0.0, 0.0, 0];
var outputLogs = false, showDebug = false;

// ====================

function Identify(bus, address)
{
	if (I2C_ADDRESS_VEML6075 > 0) return false;

	// Identify using the device ID (0x26) of the VEML6075 device...
	var deviceID = bus.readWordSync(address, 0x0c);
	if ((deviceID & 0xff) == 0x26)
	{
		I2C_BUS = bus;
		I2C_ADDRESS_VEML6075 = address;
		return true;
	}
	else return false;}

// ====================

function IsAvailable()
{
	if (I2C_ADDRESS_VEML6075) return true;
	else return false;
}

// ====================

function Start(logs, debug)
{
    if (logs) outputLogs = true;
	if (debug) showDebug = true;

	// Configure the device...
	I2C_BUS.writeByteSync(I2C_ADDRESS_VEML6075, 0x00, 0b00000001); // Power off ("shut down")
	I2C_BUS.writeByteSync(I2C_ADDRESS_VEML6075, 0x00, 0b00000000); // Power on, normal (continuous) mode, 50 ms integration time, normal dynamic range
}

function Stop() { return; }

// ====================

// VIS and IR coefficients for a non-covered (i.e. open-air, non-diffused -> no glass
// or teflon filter) designs like the Adafruit breakout, as per the VEML6075 datasheet:
const uva_a_coef = 2.22; // Default value for the UVA VIS coefficient ("a")
const uva_b_coef = 1.33; // Default value for the UVA IR coefficient ("b")
const uvb_c_coef = 2.95; // Default value for the UVB VIS coefficient ("c")
const uvb_d_coef = 1.74; // Default value for the UVB IR coefficient ("d")
const uva_resp = 0.001461; // UVA response
const uvb_resp = 0.002591; // UVB response

function Get()
{
	var uva = I2C_BUS.readWordSync(I2C_ADDRESS_VEML6075, 0x07); // Uncalibrated UVA
	var uvb = I2C_BUS.readWordSync(I2C_ADDRESS_VEML6075, 0x09); // Uncalibrated UVB
	var uvcomp1 = I2C_BUS.readWordSync(I2C_ADDRESS_VEML6075, 0x0a); // UV compensation value 1
	var uvcomp2 = I2C_BUS.readWordSync(I2C_ADDRESS_VEML6075, 0x0b); // UV compensation value 2

	// === Passing on a note by Adafruit: "INDOORS with office
	// lighting you may get VERY LOW or even NEGATIVE values." ===

	var uva_adjusted = Math.round(uva - (uva_a_coef * uvcomp1) - (uva_b_coef * uvcomp2));
	// if (uva_adjusted < 0) uva_adjusted = 0; // Allowing negative UVA values to be displayed (for now at least)
	var uvb_adjusted = Math.round(uvb - (uvb_c_coef * uvcomp1) - (uvb_d_coef * uvcomp2));
	// if (uvb_adjusted < 0) uvb_adjusted = 0; // Allowing negative UVB values to be displayed (for now at least)

	var uv_index = ((uva_adjusted * uva_resp) + (uvb_adjusted * uvb_resp)) / 2;
    if (uv_index < 0) uv_index = 0;
    
    var uv_index_level = 0;
    if (uv_index > 10.9) uv_index_level = 5; // EXTREME
    else if (uv_index > 7.9) uv_index_level = 4; // VERY HIGH
    else if (uv_index > 5.9)  uv_index_level = 3; // HIGH
    else if (uv_index > 2.9)  uv_index_level = 2; // MODERATE
    else uv_index_level = 1; // LOW

	// if (showDebug) console.log("Breakout Gardener -> DEBUG (VEML6075) -> %s %s %s %s | %s %s | %s (level %s)", uva, uvb, uvcomp1, uvcomp2, uva_adjusted, uvb_adjusted, uv_index, uv_index_level);

	data = [uva_adjusted, uvb_adjusted, uv_index, uv_index_level];

	return data;
}

// ====================

function Log()
{
	if (outputLogs)
	{
		var tempString = "Breakout Gardener -> VEML6075 -> UVA \x1b[100;97m " + data[0].toFixed(0) + " \x1b[0m / UVB \x1b[100;97m " + data[1].toFixed(0) + " \x1b[0m / UV Index \x1b[107;30m " + data[2].toFixed(1);
		if (data[3] == 5) tempString += " (Extreme) \x1b[0m.";
		else if (data[3] == 4) tempString += " (Very High) \x1b[0m.";
		else if (data[3] == 3) tempString += " (High) \x1b[0m.";
		else if (data[3] == 2) tempString += " (Moderate) \x1b[0m.";
		else tempString += " (Low) \x1b[0m.";
		console.log(tempString);
	}
}

// ====================

const pictEXT = [ 20,20,20,20,20,20,20,20,20,20,20,
				  50,50,50,20,50,20,50,20,50,50,50,
				  50,20,20,20,50,20,50,20,20,50,20,
				  50,50,50,20,20,50,20,20,20,50,20,
				  50,20,20,20,50,20,50,20,20,50,20,
				  50,50,50,20,50,20,50,20,20,50,20,
				  20,20,20,20,20,20,20,20,20,20,20 ];
const pictVER = [ 20,20,20,20,20,20,20,20,20,20,20,
				  50,20,50,20,50,50,50,20,50,50,20,
				  50,20,50,20,50,20,20,20,50,20,50,
				  50,20,50,20,50,50,50,20,50,50,20,
				  50,35,50,20,50,20,20,20,50,20,50,
				  20,50,20,20,50,50,50,20,50,20,50,
				  20,20,20,20,20,20,20,20,20,20,20 ];
const pictHIG = [ 20,20,20,20,20,20,20,20,20,20,20,
				  50,20,20,50,20,50,20,20,50,50,20,
				  50,20,20,50,20,50,20,50,20,20,20,
				  50,50,50,50,20,50,20,50,20,50,50,
				  50,20,20,50,20,50,20,50,20,20,50,
				  50,20,20,50,20,50,20,20,50,50,20,
				  20,20,20,20,20,20,20,20,20,20,20 ];
const pictMOD = [ 20,20,20,20,20,20,20,20,20,20,20,
				  50,20,50,20,35,50,35,20,50,50,20,
				  50,50,50,20,50,20,50,20,50,20,50,
				  50,35,50,20,50,20,50,20,50,20,50,
				  50,20,50,20,50,20,50,20,50,20,50,
				  50,20,50,20,35,50,35,20,50,50,20,
				  20,20,20,20,20,20,20,20,20,20,20 ];
const pictLOW = [ 20,20,20,20,20,20,20,20,20,20,20,
				  50,20,20,20,35,50,35,20,50,20,50,
				  50,20,20,20,50,20,50,20,50,20,50,
				  50,20,20,20,50,20,50,20,50,35,50,
				  50,20,20,20,50,20,50,20,50,50,50,
				  50,50,50,20,35,50,35,20,50,20,50,
				  20,20,20,20,20,20,20,20,20,20,20 ];

var previousUVlevel = 1;

function Display(refreshAll)
{
	Get();

	if (SH1107.IsAvailable())
	{
		if (refreshAll)
		{
			SH1107.Off();
			SH1107.Clear();
			SH1107.DrawTextSmall('UVA:', 4, 0, false);
			SH1107.DrawTextSmall('UVB:', 4, 2, false);
			SH1107.DrawSeparatorLine(5);
			SH1107.DrawTextSmall("UV INDEX:", 4, 7, false);
			SH1107.DrawTextSmall("VEML6075", 33, 16, false);
		}

		SH1107.DrawTextSmall(data[0].toFixed(0), 60, 0, true); // UVA value
		SH1107.DrawTextSmall(data[1].toFixed(0), 60, 2, true); // UVB value

		var xoffset = SH1107.DrawTextMedium(data[2].toFixed(1), 4, 9, true); // UV index value (x.x)

		if (data[3] == 5) SH1107.DrawTextSmall("EXTREME", 60, 10, true);
		else if (data[3] == 4) SH1107.DrawTextSmall("VERY HIGH", 60, 10, true);
		else if (data[3] == 3) SH1107.DrawTextSmall("HIGH", 60, 10, true);
		else if (data[3] == 2) SH1107.DrawTextSmall("MODERATE", 60, 10, true);
		else SH1107.DrawTextSmall("LOW", 60, 10, true);

		if (refreshAll) SH1107.On();
	}

	// ====================

	if (IS31FL3731_RGB.IsAvailable())
	{
		const icon = [0x000000, 0x000000, 0x000000, 0x000000, 0x000000,
					  0x000000, 0x000000, 0x000000, 0x000000, 0x000000,
					  0x000000, 0x000000, 0x000000, 0x000000, 0x000000,
					  0x000000, 0x000000, 0x000000, 0x000000, 0x000000,
					  0x000000, 0x000000, 0x000000, 0x000000, 0x000000 ];

		// Display UV index colour... (see e.g. https://en.wikipedia.org/wiki/Ultraviolet_index )
		// (green-yellow-orange-red-violet with increased strength of irradiance)
		var uviColor;
		if (data[3] == 5) uviColor = 0x6600aa; // Extreme
		else if (data[3] == 4) uviColor = 0xaa0000; // Very High
		else if (data[3] == 3) uviColor = 0xaa4400; // High
		else if (data[3] == 2) uviColor = 0xaa8800; // Moderate
		else uviColor = 0x008800; // Low

		icon[6] = icon[7] = icon[8] = icon[11] = icon[12] = icon[13] = icon[16] = icon[17] = icon[18] = uviColor;

		IS31FL3731_RGB.Display(icon);
	}

	// ====================

	if (IS31FL3731_WHITE.IsAvailable())
	{
/*
		if (data[3] == 5) IS31FL3731_WHITE.DrawString("E"); // Extreme
		else if (data[3] == 4) IS31FL3731_WHITE.DrawString("V"); // Very High
		else if (data[3] == 3) IS31FL3731_WHITE.DrawString("H"); // High
		else if (data[3] == 2) IS31FL3731_WHITE.DrawString("M"); // Moderate
		else IS31FL3731_WHITE.DrawString("L"); // Low
*/
		if (data[3] == 5) IS31FL3731_WHITE.Display(pictEXT); // Extreme
		else if (data[3] == 4) IS31FL3731_WHITE.Display(pictVER); // Very High
		else if (data[3] == 3) IS31FL3731_WHITE.Display(pictHIG); // High
		else if (data[3] == 2) IS31FL3731_WHITE.Display(pictMOD); // Moderate
		else IS31FL3731_WHITE.Display(pictLOW); // Low
    }
    
    // ====================
    
    if (HT16K33.IsAvailable())
    {
        var uvi = 'UVI' + data[3].toString();
        HT16K33.Display(uvi);
    }

    // ====================

    if (DRV2605.IsAvailable())
    {
        if (data[3] != previousUVlevel)
        {
            if (data[3] == 3) DRV2605.Play(10); // UV index High (level 3) -> Play a "Double Click 100%" buzz
            else if (data[3] == 4) DRV2605.Play(12); // UV index Very High (level 4) -> Play a "Triple Click 100%" buzz
            else if (data[3] == 5) DRV2605.Play(16); // UV index Extreme (level 5) -> Play an "Alert 1000 ms" buzz

            previousUVlevel = data[3];
        }
    }

	// ====================

	if (refreshAll) Log();
}

// ================================================================================
