{
  description = "Amaryllis development and CI toolchain";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";

  outputs = { nixpkgs, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in
    {
      devShells = forAllSystems (
        system:
        let
          pkgs = import nixpkgs { inherit system; };
          nodejs = pkgs.nodejs_22;
        in
        {
          default = pkgs.mkShell {
            packages = [
              nodejs
              pkgs.yarn
              pkgs.git
              pkgs.gnumake
              pkgs.pkg-config
              pkgs.python3
            ];
          };
        }
      );

      checks = forAllSystems (
        system:
        let
          pkgs = import nixpkgs { inherit system; };
          nodejs = pkgs.nodejs_22;
        in
        {
          toolchain = pkgs.runCommand "amaryllis-toolchain" {
            nativeBuildInputs = [ nodejs pkgs.yarn ];
          } ''
            test "${nodejs.version}" = "$(node --version | sed 's/^v//')"
            test -f ${./.yarn/releases/yarn-3.6.1.cjs}
            test "$(yarn --version)" = "3.6.1"
            touch "$out"
          '';
        }
      );
    };
}
