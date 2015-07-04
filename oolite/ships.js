var ships = [
	{
		aft_eject_position : "0.0 -13.25 -23.8",
		ai_type : "oolite-traderAI.js",
		auto_ai : true,
		auto_weapons : true,
		cargo_type : "CARGO_NOT_CARGO",
		custom_views :
		[
			{
				view_description : "Rear View",
				view_orientation : "1.0 0.0 0.0 0.0",
				view_position : "0.0 30.0 -200.0",
				weapon_facing : "FORWARD",
			},
			{
				view_description : "Rear Right View",
				view_orientation : "0.9239 0.0 0.3827 0.0",
				view_position : "141.42 30.0 -141.42",
				weapon_facing : "FORWARD",
			},
			{
				view_description : "Right View",
				view_orientation : "0.7071 0.0 0.7071 0.0",
				view_position : "200.0 30.0 0.0",
				weapon_facing : "FORWARD",
			},
			{
				view_description : "Front Right View",
				view_orientation : "0.3827 0.0 0.9239 0.0",
				view_position : "141.42 30.0 141.42",
				weapon_facing : "FORWARD",
			},
			{
				view_description : "Front View",
				view_orientation : "0.0 0.0 1.0 0.0",
				view_position : "0.0 30.0 200.0",
				weapon_facing : "FORWARD",
			},
			{
				view_description : "Front Left View",
				view_orientation : "0.3827 0.0 -0.9239 0.0",
				view_position : "-141.42 30.0 141.42",
				weapon_facing : "FORWARD",
			},
			{
				view_description : "Left View",
				view_orientation : "0.7071 0.0 -0.7071 0.0",
				view_position : "-200.0 30.0 0.0",
				weapon_facing : "FORWARD",
			},
			{
				view_description : "Rear Left View",
				view_orientation : "0.9239 0.0 -0.3827 0.0",
				view_position : "-141.42 30.0 -141.42",
				weapon_facing : "FORWARD",
			},
			{
				view_description : "Top View",
				view_orientation : "-0.7071 0.7071 0.0 0.0",
				view_position : "0.0 200.0 -15.0",
				weapon_facing : "FORWARD",
			},
			{
				view_description : "Bottom View",
				view_orientation : "0.0 0.0 0.7071 0.7071",
				view_position : "0.0 -200.0 -15.0",
				weapon_facing : "FORWARD",
			}
		],
		energy_recharge_rate : 4,
		exhaust : 
		[		
			"10.7601 6.3008 -33.8587  6.3 5.6 1.0",
			"-10.7601 6.3008 -33.8587 6.3 5.6 1.0"
		],
		forward_weapon_type : "WEAPON_BEAM_LASER",
		frangible : 0,
		fuel : 70,
		has_ecm : 0.15,
		has_escape_pod : 0.95,
		has_scoop : 0.95,
		is_template : 1,
		likely_cargo : 15,
		materials : 
		{ 
			"Hull" : 
			{ 
				diffuse_map : "oolite_cobra3_diffuse.png",
				specular_color : [ 0.2, 0.2, 0.2 ],
				shininess : 5,
				emission_map : { name : "oolite_cobra3_diffuse.png", extract_channel : "a" },
				emission_modulate_color : [0.9926, 0.9686, 0.7325, 1.0],
			},
			"Gun" : 
				{ 
					diffuse_map : "oolite_cobra3_subents.png",
					specular_color : [ 0.2, 0.2, 0.2 ],
					shininess : 5
				}
		},
		max_cargo : 20,
		max_energy : 256,
		max_flight_pitch : 1,
		max_flight_roll : 2,
		max_flight_speed : 350,
		max_missiles : 4,
		missile_launch_position : "0.0 -15.5 -24.5",
		missiles : 3,
		model : {
		    dat_file : "oolite_cobra3.dat",
		    texture : {
			images : [ "oolite_cobra3_diffuse.png", "oolite_cobra3_subents.png" ]
		    }
		},
		name : "Cobra Mark III",
		scoop_position : "0.0 -5.5 25.0",
		thrust : 32,
		view_position_aft : "0.0 6.0 -35.5",
		view_position_forward : "0.0 7.25 31.0",
		view_position_port : "-35.5 7.5 0.0",
		view_position_starboard : "35.5 7.5 0.0",
		weapon_facings : 15,
		weapon_position_aft : "0.0 0.0 -33.5",
		weapon_position_forward : "-0.0961 0.9367 43.4655",
		weapon_position_port : "-47.4 -2.3 0.0",
		weapon_position_starboard : "47.4 -2.3 0.0",
	},
	{
		aft_eject_position : "0.0 -7.5 -23.68",
		ai_type : "oolite-scavengerAI.js",
		auto_ai : true,
		auto_weapons : true,
		cargo_type : "CARGO_NOT_CARGO",
		custom_views :
		[
			{
				view_description : "Rear View  (DEBUG)",
				view_orientation : "1.0 0.0 0.0 0.0",
				view_position : "0.0 15.0 -100",
				weapon_facing : "FORWARD",
			},
			{
				view_description : "Rear Right View",
				view_orientation : "0.9239 0.0 0.3827 0.0",
				view_position : "70.71 15.0 -70.71",
				weapon_facing : "FORWARD",
			},
			{
				view_description : "Right View",
				view_orientation : "0.7071 0.0 0.7071 0.0",
				view_position : "100.0 15.0 0.0",
				weapon_facing : "FORWARD",
			},
			{
				view_description : "Front Right View",
				view_orientation : "0.3827 0.0 0.9239 0.0",
				view_position : "70.71 15.0 70.71",
				weapon_facing : "FORWARD",
			},
			{
				view_description : "Front View",
				view_orientation : "0.0 0.0 1.0 0.0",
				view_position : "0.0 15.0 100.0",
				weapon_facing : "FORWARD",
			},
			{
				view_description : "Front Left View",
				view_orientation : "0.3827 0.0 -0.9239 0.0",
				view_position : "-70.71 15.0 70.71",
				weapon_facing : "FORWARD",
			},
			{
				view_description : "Left View",
				view_orientation : "0.7071 0.0 -0.7071 0.0",
				view_position : "-100.0 15.0 0.0",
				weapon_facing : "FORWARD",
			},
			{
				view_description : "Rear Left View",
				view_orientation : "0.9239 0.0 -0.3827 0.0",
				view_position : "-70.71 15.0 -70.71",
				weapon_facing : "FORWARD",
			},
			{
				view_description : "Top View",
				view_orientation : "-0.7071 0.7071 0.0 0.0",
				view_position : "0.0 100.0 -10.0",
				weapon_facing : "FORWARD",
			},
			{
				view_description : "Bottom View",
				view_orientation : "0.0 0.0 0.7071 0.7071",
				view_position : "0.0 -100.0 -10.0",
				weapon_facing : "FORWARD",
			}
		],
		energy_recharge_rate : 2,
		exhaust : ["0.0 1.089 -20.6786 3.6 2.4 0.7"],
		forward_weapon_type : "WEAPON_PULSE_LASER",
		fuel : 70,
		has_ecm : 0.01,
		has_scoop : true,
		hud : "hud-small.plist",
		is_template : 1,
		likely_cargo : 2,
		materials :
		{
			"Hull" :
			{
				diffuse_map : "oolite_adder_diffuse.png", 
				specular_color : [0.2, 0.2, 0.2],
				shininess : 5,
				emission_map : 
				{
					name : "oolite_adder_diffuse.png", extract_channel : "a",
				},
				emission_modulate_color : [0.9926, 0.9686, 0.7325, 1.0],
			},
		},
		max_cargo : 5,
		max_energy : 85,
		max_flight_pitch : 2,
		max_flight_roll : 2.8,
		max_flight_speed : 240,
		max_missiles : 1,
		missile_launch_position : "0.0 -5.1 19.2374",
		missiles : 1,
		model : {
		    dat_file : "oolite_adder.dat",
		    texture : {
			images : [ "oolite_adder_diffuse.png" ]
		    }
		},
		name : "Adder",
		roles : "trader[0.25] trader-courier[0.5] trader-smuggler pirate-light-fighter[0.25] pirate[0.2] scavenger shuttle hermit-ship",
		scoop_position : "0.0 -5.1 22.724",
		thrust : 30,
		view_position_aft : "0.0 5.0 -22.5",
		view_position_forward : "0.0 3.5 17.4",
		view_position_port : "-12.0 1.5 -1.0",
		view_position_starboard : "12.0 1.5 -1.0",
		weapon_facings : 1,
		weapon_position_aft : "0.0 0.0 -22.5",
		weapon_position_forward : "0.0 -1.6769 28.8523",
		weapon_position_port : "-15.0 0.0 -14.5",
		weapon_position_starboard : "15.0 0.0 -14.5",
	},
];
