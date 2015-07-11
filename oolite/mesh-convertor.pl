#!/usr/bin/perl
use v5.14;
use strict;
use warnings;
use feature qw{say state};
use Data::Dumper;  # for debugging

# https://gist.github.com/grondilu/aa164666244e3fdeee8e
#
my $float = qr{[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?};
my (@vertices, @faces, @texture, %image, @names);

my $texture_images_dir = '../images/textures';
my $texture_image;
my (%new_vertices, @new_vertices);
my ($nverts, $nfaces, $nnames) = (0, 0, 0);

unless (caller) {
    gather_data();

    # pick one!
    not_completely_dumb_mesher();
    show_results();
}

sub gather_data {
    for my $line (<>) {
	state $current_section;
	chomp $line;

	# commas are optional and must be treated as field separator
	# so we replace them by spaces and consider spaces as field separators
	$line =~ s/[,\s\t][\s\t]*/ /g;

	# remove any comment at the end of line
	$line =~ s/#.*//g;

	given ($line) {
	    when (/^END/) { last }
	    when (/^\s*$/ || /^\/\//) { next }
	    when (/^NVERTS/) { $nverts = (split /\s+/)[1]; next; }
	    when (/^NFACES/) { $nfaces = (split /\s+/)[1]; next; }
	    when (/^VERTEX/) { $current_section = 'vertex'; next; }
	    when (/^FACES/ ) { $current_section = 'faces' ; next; }
	    when (/^TEXTURES/) { $current_section = 'texture'; next; }
	    when (/^NAMES/) {
		$current_section = 'names';
		$nnames = (split /\s+/)[1];
		next;
	    }
	}
	given ($current_section) {
	    when ('vertex') { push @vertices, [ split /\s+/, $line ] }
	    when ('faces') {
		my @fields = split /\s+/, $line;
		@fields == 10 or die "unexpected number of fields in line: $line";
		$fields[6] == 3 or die "unexpected number of vertices";
		push @faces, {
		    rgb => [ @fields[0..2] ],
		    normal => [ @fields[3..5] ],
		    vertex_indices => [ @fields[7..9] ]
		}
	    }
	    when ('texture') {
		my @fields = split /\s+/, $line;
		my $image = shift @fields;
		$image{$image}++;
		#$fields[0] == 1 && $fields[1] == 1 or die "unexpected range in the texture (line is $line)";
		$fields[$_]/=$fields[0] for 2, 4, 6;
		$fields[$_]/=$fields[1] for 3, 5, 7;
		push @texture, {
		    image => $image,
		    coord => [
			"$fields[2],$fields[3]", 
			"$fields[4],$fields[5]", 
			"$fields[6],$fields[7]"
		    ]
		};
	    }
	    when ('names') { push @names, $line }
	}
    }

    @texture == @faces
	or die "unexpected number of texture coordinates";

}

sub not_completely_dumb_mesher {

    $texture_image = $texture[0]->{'image'};
    for my $f (0 .. $#faces) {
	my @vertex_indices = @{$faces[$f]->{'vertex_indices'}};
	my @coord = @{$texture[$f]->{'coord'}};
	my @new_vertex_indices;
	for (0 .. 2) {
	    push @new_vertex_indices,
	    my $new_index = "$vertex_indices[$_]:$coord[$_]";
	    $new_vertices{$new_index}++;
	}
	$faces[$f]->{'new_vertex_indices'} = [ @new_vertex_indices ];
    }

    for (0 .. $#faces) {
	my @vertex_indices = @{$faces[$_]->{'vertex_indices'}};
	my @texture_coordinates = @{$texture[$_]->{'coord'}};
	for (0 .. 2) {
	    $vertex_indices[$_] .= ':' . $texture_coordinates[$_];
	}
	$faces[$_]->{'vertex_indices'} = [ @vertex_indices ];
    }

    for (@faces) {
	state %cache;
	for (@{$_->{'vertex_indices'}}) {
	    push @new_vertices, $_ unless $cache{$_}++;
	}
    }

    for (0 .. $#new_vertices) {
	$new_vertices{$new_vertices[$_]} = $_;
    }

}

sub show_results {

    print <<EOF
{
    dat_file : "UNSPECIFIED",
    vertices : [ @{[
	join ',',
	map { @{$vertices[$_]} }
	map { (split ':')[0] }
	@new_vertices
    ]} ],
    faces : [ @{[
	join ',',
	map { $new_vertices{$_} }
	map { @{$_->{'vertex_indices'}} }
	@faces
    ]} ],
    texture : {
	images : [ "$texture_image" ],
	coordinates : [ @{[ join ',', map { (split ':')[1] } @new_vertices ]} ]
    }
}
EOF
    ;

}


# say "nverts = $nverts, nfaces = $nfaces, nnames = $nnames";

#say join ', ', @$_ for @vertices;
