terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

resource "aws_security_group" "perfumes_api" {
  name        = "perfumes-api-sg"
  description = "Acceso a la API de Perfumes (EC2)"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "API HTTP"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = [var.allowed_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "perfumes-api-sg"
  }
}

resource "aws_iam_role" "ssm" {
  name = "perfumes-api-ec2-ssm"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.ssm.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "ssm" {
  name = "perfumes-api-ec2-ssm"
  role = aws_iam_role.ssm.name
}

resource "aws_instance" "perfumes_api" {
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = var.instance_type
  subnet_id              = data.aws_subnets.default.ids[0]
  vpc_security_group_ids = [aws_security_group.perfumes_api.id]
  iam_instance_profile   = aws_iam_instance_profile.ssm.name

  user_data = file("${path.module}/user_data.sh")

  tags = {
    Name = "perfumes-api"
  }
}

resource "aws_eip" "perfumes_api" {
  instance = aws_instance.perfumes_api.id
  domain   = "vpc"

  tags = {
    Name = "perfumes-api-eip"
  }
}
