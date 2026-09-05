{
  description = "Amaryllis development and CI toolchain";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";

  outputs = { self, nixpkgs, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
      cyclonedxVersion = "0.32.0";
      cyclonedxReleases = {
        x86_64-linux = {
          asset = "cyclonedx-linux-musl-x64";
          hash = "sha256-KROOYGjmzy3GDndtB4wrF8v0V1DEhaoSwo4f71VWoV8=";
        };
        aarch64-linux = {
          asset = "cyclonedx-linux-arm64";
          hash = "sha256-q/C3xWSKWxJ3kdaRytQfAErO6ifHW7QslXL9yWlHcM8=";
        };
        x86_64-darwin = {
          asset = "cyclonedx-osx-x64";
          hash = "sha256-oTpd4S0Qz8z48iJhS5mvJD/uVJGw7HOFCx1voFDUrUo=";
        };
        aarch64-darwin = {
          asset = "cyclonedx-osx-arm64";
          hash = "sha256-g76KlZnx3OElIgi9TQuxUwjsoFRoFPtytItyRtNegy4=";
        };
      };
    in
    {
      packages = forAllSystems (
        system:
        let
          pkgs = import nixpkgs { inherit system; };
          nodejs = pkgs.nodejs_24;
          yarnLauncher = pkgs.writeShellScriptBin "yarn" ''
            exec ${nodejs}/bin/node ${./.yarn/releases/yarn-3.6.1.cjs} "$@"
          '';
          ciToolchain = pkgs.symlinkJoin {
            name = "amaryllis-ci-toolchain";
            paths = [
              nodejs
              yarnLauncher
              pkgs.git
              pkgs.gnumake
              pkgs.pkg-config
              pkgs.python3
            ];
          };
          cyclonedxRelease = cyclonedxReleases.${system};
          cyclonedxSource = pkgs.fetchurl {
            url = "https://github.com/CycloneDX/cyclonedx-cli/releases/download/v${cyclonedxVersion}/${cyclonedxRelease.asset}";
            hash = cyclonedxRelease.hash;
          };
          cyclonedxValidator = pkgs.runCommand "cyclonedx-cli-${cyclonedxVersion}" { } ''
            install -Dm755 ${cyclonedxSource} "$out/bin/cyclonedx"
          '';
        in
        {
          ci-toolchain = ciToolchain;
          cyclonedx-validator = cyclonedxValidator;
          default = ciToolchain;
        }
      );

      devShells = forAllSystems (
        system:
        let
          pkgs = import nixpkgs { inherit system; };
        in
        {
          default = pkgs.mkShell {
            packages = [ self.packages.${system}.ci-toolchain ];
          };
        }
      );

      checks = forAllSystems (
        system:
        let
          pkgs = import nixpkgs { inherit system; };
          nodejs = pkgs.nodejs_24;
        in
        {
          toolchain = pkgs.runCommand "amaryllis-toolchain-check" {
            nativeBuildInputs = [ self.packages.${system}.ci-toolchain ];
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
